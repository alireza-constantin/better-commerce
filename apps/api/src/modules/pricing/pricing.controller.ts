import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsArray, IsString, IsUUID, ArrayMaxSize } from 'class-validator';
import type { Request } from 'express';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PricingService } from './pricing.service';

class SetPriceDto {
  @IsString()
  amount!: string;
}

class ListPricesDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  variantIds!: string[];
}

@AdminApi()
@ApiTags('Pricing administration')
@ApiSessionAuthenticated()
@Controller('admin/pricing')
export class PricingAdminController {
  constructor(private readonly pricing: PricingService) {}

  @Post('variants/:variantId')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.PRICING_WRITE)
  set(
    @Req() request: Request,
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Body() dto: SetPriceDto,
  ) {
    return this.pricing.setCurrentPrice(variantId, dto.amount, request.authUser!.id);
  }

  @Post('current')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.PRICING_READ)
  list(@Body() dto: ListPricesDto) {
    return this.pricing.listCurrentPrices(dto.variantIds);
  }
}
