import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PermissionKey } from '../authorization/data';
import { WishlistAlertService } from './wishlist-alert.service';

class EvaluateAlertDto {
  @IsUUID()
  variantId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(96)
  episodeKey!: string;

  @IsBoolean()
  available!: boolean;
}

@AdminApi()
@ApiTags('Wishlist alert operations')
@ApiSessionAuthenticated()
@Controller('admin/wishlist-alerts')
export class WishlistAlertAdminController {
  constructor(private readonly alerts: WishlistAlertService) {}

  @Post('evaluate')
  @ApiCsrfProtected()
  @RequirePermissions(
    PermissionKey.CUSTOMERS_WISHLISTS_READ,
    PermissionKey.COMMUNICATIONS_SEND,
  )
  @ApiCreatedResponse()
  async evaluate(@Body() dto: EvaluateAlertDto) {
    return { sent: await this.alerts.evaluateVariant(dto.variantId, dto.episodeKey, dto.available) };
  }
}
