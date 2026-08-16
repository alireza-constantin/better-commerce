import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RequestContextService } from '../../platform/observability';
import {
  ApiCsrfProtected,
  ApiProblemResponse,
  ApiSessionAuthenticated,
} from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { parseMoney } from '../pricing';
import { PromotionDomainError } from './promotions.errors';
import { PromotionsService } from './promotions.service';
import {
  CreatePromotionDto,
  PromotionListQueryDto,
  PromotionPageResponseDto,
  PromotionRedemptionListQueryDto,
  PromotionRedemptionPageResponseDto,
  PromotionLifecycleDto,
  PromotionResponseDto,
  ReplacePromotionDefinitionDto,
} from './promotions.dto';

const statusByCode: Record<PromotionDomainError['code'], HttpStatus> = {
  'promotion.validation_failed': HttpStatus.UNPROCESSABLE_ENTITY,
  'promotion.not_found': HttpStatus.NOT_FOUND,
  'promotion.version_conflict': HttpStatus.CONFLICT,
  'promotion.code_invalid': HttpStatus.UNPROCESSABLE_ENTITY,
  'promotion.not_eligible': HttpStatus.UNPROCESSABLE_ENTITY,
  'promotion.limit_reached': HttpStatus.UNPROCESSABLE_ENTITY,
  'promotion.invalid_state': HttpStatus.CONFLICT,
  'promotion.currency_mismatch': HttpStatus.UNPROCESSABLE_ENTITY,
};

function translatePromotionError(error: unknown): never {
  if (error instanceof PromotionDomainError) {
    throw new HttpException(
      { message: error.message, code: error.code },
      statusByCode[error.code],
    );
  }
  throw error;
}

@AdminApi()
@ApiTags('Promotions administration')
@ApiSessionAuthenticated()
@Controller('admin/promotions')
export class PromotionsAdminController {
  constructor(
    private readonly promotions: PromotionsService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @RequirePermissions(PermissionKey.PROMOTIONS_READ)
  @ApiOkResponse({ type: PromotionPageResponseDto })
  async list(@Query() query: PromotionListQueryDto) {
    try {
      return await this.promotions.list(query);
    } catch (error) {
      translatePromotionError(error);
    }
  }

  @Get(':promotionId')
  @RequirePermissions(PermissionKey.PROMOTIONS_READ)
  @ApiOkResponse({ type: PromotionResponseDto })
  async get(
    @Param('promotionId', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    try {
      return await this.promotions.get(id);
    } catch (error) {
      translatePromotionError(error);
    }
  }

  @Get(':promotionId/redemptions')
  @RequirePermissions(PermissionKey.PROMOTIONS_READ)
  @ApiOkResponse({ type: PromotionRedemptionPageResponseDto })
  async redemptions(
    @Param('promotionId', new ParseUUIDPipe({ version: '4' }))
    promotionId: string,
    @Query() query: PromotionRedemptionListQueryDto,
  ) {
    try {
      return await this.promotions.listRedemptions(promotionId, query);
    } catch (error) {
      translatePromotionError(error);
    }
  }

  @Post()
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.PROMOTIONS_WRITE)
  @ApiCreatedResponse({ type: PromotionResponseDto })
  async create(@Req() request: Request, @Body() dto: CreatePromotionDto) {
    try {
      const promotion = await this.promotions.createDraft({
        definition: this.definition(dto),
        actorUserId: request.authUser!.id,
        requestId: this.requestContext.getRequestId() ?? null,
      });
      return this.promotions.get((promotion as { id: string }).id);
    } catch (error) {
      translatePromotionError(error);
    }
  }

  @Put(':promotionId/definition')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.PROMOTIONS_WRITE)
  @ApiOkResponse({ type: PromotionResponseDto })
  @ApiProblemResponse(409, 'promotion.version_conflict')
  async replace(
    @Req() request: Request,
    @Param('promotionId', new ParseUUIDPipe({ version: '4' }))
    promotionId: string,
    @Body() dto: ReplacePromotionDefinitionDto,
  ) {
    try {
      await this.promotions.replaceDefinition({
        promotionId,
        expectedVersion: dto.expectedVersion,
        definition: this.definition(dto),
        actorUserId: request.authUser!.id,
        requestId: this.requestContext.getRequestId() ?? null,
      });
      return this.promotions.get(promotionId);
    } catch (error) {
      translatePromotionError(error);
    }
  }

  @Post(':promotionId/:action')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.PROMOTIONS_WRITE)
  @ApiOkResponse({ type: PromotionResponseDto })
  async lifecycle(
    @Req() request: Request,
    @Param('promotionId', new ParseUUIDPipe({ version: '4' }))
    promotionId: string,
    @Param('action') action: 'activate' | 'pause' | 'end',
    @Body() dto: PromotionLifecycleDto,
  ) {
    if (!['activate', 'pause', 'end'].includes(action)) {
      throw new HttpException('Unknown promotion action', HttpStatus.NOT_FOUND);
    }
    try {
      await this.promotions.transition({
        promotionId,
        expectedVersion: dto.expectedVersion,
        status:
          action === 'activate'
            ? 'active'
            : action === 'pause'
              ? 'paused'
              : 'ended',
        actorUserId: request.authUser!.id,
        requestId: this.requestContext.getRequestId() ?? null,
      });
      return this.promotions.get(promotionId);
    } catch (error) {
      translatePromotionError(error);
    }
  }

  private definition(dto: CreatePromotionDto | ReplacePromotionDefinitionDto) {
    try {
      return {
        name: dto.name,
        description: dto.description,
        eligibility: dto.eligibility,
        code: dto.code,
        rule:
          dto.rule.kind === 'percentage'
            ? { kind: 'percentage' as const, percentage: dto.rule.percentage }
            : {
                kind: 'fixed_amount' as const,
                amount: parseMoney(dto.rule.amount!, dto.rule.currency!),
              },
        target: dto.target,
        priority: dto.priority,
        startsAt: new Date(dto.startsAt),
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
        totalLimit: dto.totalLimit,
        perCustomerLimit: dto.perCustomerLimit,
      };
    } catch (error) {
      if (error instanceof PromotionDomainError) throw error;
      throw new PromotionDomainError(
        'promotion.validation_failed',
        error instanceof Error
          ? error.message
          : 'Promotion definition is invalid',
      );
    }
  }
}
