import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { Request } from 'express';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { InventoryTrackingMode } from './inventory-item.entity';
import { InventoryService } from './inventory.service';

class ConfigureInventoryDto {
  @IsEnum(InventoryTrackingMode)
  trackingMode!: InventoryTrackingMode;

  @IsInt()
  @Min(0)
  initialOnHand!: number;
}

class AdjustInventoryDto {
  @IsInt()
  delta!: number;

  @IsString()
  @MaxLength(80)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

@AdminApi()
@ApiTags('Inventory administration')
@ApiSessionAuthenticated()
@Controller('admin/inventory/variants')
export class InventoryAdminController {
  constructor(private readonly inventory: InventoryService) {}

  @Post(':variantId/configure')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.INVENTORY_ADJUST)
  configure(
    @Req() request: Request,
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Body() dto: ConfigureInventoryDto,
  ) {
    return this.inventory.configure(
      variantId,
      dto.trackingMode,
      dto.initialOnHand,
      request.authUser!.id,
    );
  }

  @Post(':variantId/adjust')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.INVENTORY_ADJUST)
  adjust(
    @Req() request: Request,
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Body() dto: AdjustInventoryDto,
  ) {
    return this.inventory.adjust(
      variantId,
      dto.delta,
      dto.reasonCode,
      request.authUser!.id,
      dto.note,
    );
  }
}
