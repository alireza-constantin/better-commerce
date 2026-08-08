import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { Request } from 'express';
import { RequestContextService } from '../../platform/observability';
import {
  ApiCsrfProtected,
  ApiSessionAuthenticated,
} from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { InventoryTrackingMode } from './inventory-item.entity';
import { InventoryService } from './persistence/inventory.service';
import {
  CurrentInventoryQueryDto,
  CurrentInventoryResponseDto,
  InventoryResponseDto,
} from './inventory.dto';

class ConfigureInventoryDto {
  @ApiProperty({ enum: InventoryTrackingMode })
  @IsEnum(InventoryTrackingMode)
  trackingMode!: InventoryTrackingMode;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  initialOnHand!: number;
}

class AdjustInventoryDto {
  @ApiProperty({ description: 'Non-zero signed stock adjustment.' })
  @IsInt()
  delta!: number;

  @ApiProperty({ maxLength: 80 })
  @IsString()
  @MaxLength(80)
  reasonCode!: string;

  @ApiPropertyOptional({ maxLength: 500 })
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
  constructor(
    private readonly inventory: InventoryService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('current')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.INVENTORY_READ)
  @ApiCreatedResponse({ type: [CurrentInventoryResponseDto] })
  list(@Body() dto: CurrentInventoryQueryDto) {
    return this.inventory.listCurrentInventory(dto.variantIds);
  }

  @Post(':variantId/configure')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.INVENTORY_ADJUST)
  @ApiCreatedResponse({ type: InventoryResponseDto })
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
      this.requestContext.getRequestId() ?? null,
    );
  }

  @Post(':variantId/adjust')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.INVENTORY_ADJUST)
  @ApiCreatedResponse({ type: InventoryResponseDto })
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
      this.requestContext.getRequestId() ?? null,
    );
  }
}
