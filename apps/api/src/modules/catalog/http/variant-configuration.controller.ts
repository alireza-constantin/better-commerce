import {
  Body,
  Controller,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { DatabaseTransactionRunner } from '../../../platform/database';
import {
  ApiCsrfProtected,
  ApiSessionAuthenticated,
} from '../../../platform/openapi';
import { PermissionKey } from '../../authorization/data';
import { AdminApi, RequirePermissions } from '../../authorization/enforcement';
import { CatalogApplicationService } from '../application/catalog-application.service';
import { CatalogApplicationError } from '../application/catalog-application.error';
import { ReplaceConfigurationDto } from './catalog.dto';
import { PricingService } from '../../pricing/persistence/pricing.service';
import { InventoryService } from '../../inventory/persistence/inventory.service';
import { InventoryTrackingMode } from '../../inventory/inventory-item.entity';
import {
  COMMERCE_AUDIT_CONTRACT,
  CommerceAuditAction,
  type CommerceAuditContract,
} from '../../commerce-audit';

@AdminApi()
@ApiSessionAuthenticated()
@Controller('admin/catalog')
export class VariantConfigurationController {
  constructor(
    private readonly catalog: CatalogApplicationService,
    private readonly pricing: PricingService,
    private readonly inventory: InventoryService,
    private readonly transactions: DatabaseTransactionRunner,
    @Inject(COMMERCE_AUDIT_CONTRACT)
    private readonly audit: CommerceAuditContract,
  ) {}

  @Put('products/:productId/configuration')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_PRODUCTS_WRITE)
  @ApiOperation({
    summary: 'Atomically replace Product variants and operational state',
  })
  @ApiOkResponse()
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  @ApiConflictResponse()
  async replace(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: ReplaceConfigurationDto,
    @Req() request: Request,
  ) {
    const current = await this.catalog.getAdminDetail(productId);
    const changesExistingVariant = dto.variants.some(
      (variant) =>
        variant.id &&
        current.variants.some(
          (existing) =>
            existing.id === variant.id && existing.status !== variant.status,
        ),
    );
    if (
      changesExistingVariant &&
      !request.authorization?.permissions.includes(
        PermissionKey.CATALOG_PRODUCTS_ARCHIVE,
      )
    )
      throw new ForbiddenException();
    if (
      dto.prices?.length &&
      !request.authorization?.permissions.includes(PermissionKey.PRICING_WRITE)
    )
      throw new ForbiddenException();
    if (
      dto.inventory?.length &&
      !request.authorization?.permissions.includes(
        PermissionKey.INVENTORY_ADJUST,
      )
    )
      throw new ForbiddenException();

    const actorUserId = request.authUser!.id;
    try {
      return await this.transactions.run(async (transaction) => {
        const detail = await this.catalog.replaceConfiguration(
          productId,
          dto,
          transaction,
        );
        const variantIds = new Set(
          detail.variants.map((variant) => variant.id),
        );
        for (const price of dto.prices ?? []) {
          if (!variantIds.has(price.variantId))
            throw new Error('Price change references an unknown Variant');
          await this.pricing.applyCurrentPrice(
            price.variantId,
            price.amount ?? null,
            actorUserId,
            null,
            transaction,
          );
        }
        for (const inventory of dto.inventory ?? []) {
          if (!variantIds.has(inventory.variantId))
            throw new Error('Inventory change references an unknown Variant');
          await this.inventory.applyCurrentInventory(
            inventory.variantId,
            inventory.trackingMode === 'tracked'
              ? InventoryTrackingMode.TRACKED
              : inventory.trackingMode === 'untracked'
                ? InventoryTrackingMode.UNTRACKED
                : 'not_configured',
            inventory.currentOnHand ?? null,
            inventory.reasonCode ?? null,
            inventory.note ?? undefined,
            actorUserId,
            null,
            transaction,
          );
        }
        await this.audit.record(
          {
            actorUserId,
            action: CommerceAuditAction.VARIANT_CONFIGURATION_REPLACED,
            targetType: 'product',
            targetId: productId,
            requestId: null,
            metadata: {
              variantCount: detail.variants.length,
              priceChangeCount: dto.prices?.length ?? 0,
              inventoryChangeCount: dto.inventory?.length ?? 0,
              mediaAssignmentCount: dto.variants.reduce(
                (count, variant) => count + (variant.mediaIds?.length ?? 0),
                0,
              ),
            },
          },
          transaction,
        );
        return detail;
      });
    } catch (error) {
      if (error instanceof CatalogApplicationError) {
        const status =
          error.code === 'catalog.not_found'
            ? HttpStatus.NOT_FOUND
            : error.code === 'catalog.media_invalid' ||
                error.code === 'catalog.validation_failed'
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.CONFLICT;
        throw new HttpException(
          {
            message: error.message,
            code: error.code,
            ...(error.currentVersion === undefined
              ? {}
              : { currentVersion: error.currentVersion }),
          },
          status,
        );
      }
      throw new HttpException(
        { message: error instanceof Error ? error.message : 'Save failed' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
