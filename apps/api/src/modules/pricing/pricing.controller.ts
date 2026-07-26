import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsArray, IsString, IsUUID, ArrayMaxSize } from 'class-validator';
import type { Request } from 'express';
import { RequestContextService } from '../../platform/observability';
import {
  ApiCsrfProtected,
  ApiSessionAuthenticated,
} from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PricingService } from './persistence/pricing.service';
import { CurrentPriceResponseDto, PriceResponseDto } from './pricing.dto';

class SetPriceDto {
  @ApiProperty({ example: '120.00', pattern: '^\\d+(\\.\\d+)?$' })
  @IsString()
  amount!: string;
}

class ListPricesDto {
  @ApiProperty({ format: 'uuid', maxItems: 100, type: [String] })
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
  constructor(
    private readonly pricing: PricingService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('variants/:variantId')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.PRICING_WRITE)
  @ApiCreatedResponse({ type: PriceResponseDto })
  set(
    @Req() request: Request,
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Body() dto: SetPriceDto,
  ) {
    return this.pricing.setCurrentPrice(
      variantId,
      dto.amount,
      request.authUser!.id,
      this.requestContext.getRequestId() ?? null,
    );
  }

  @Post('current')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.PRICING_READ)
  @ApiCreatedResponse({ type: [CurrentPriceResponseDto] })
  list(@Body() dto: ListPricesDto) {
    return this.pricing.listCurrentPrices(dto.variantIds);
  }
}
