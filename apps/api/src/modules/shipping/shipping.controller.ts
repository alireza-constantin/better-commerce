import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import type { Request } from 'express';
import { RequestContextService } from '../../platform/observability';
import {
  ApiCsrfProtected,
  ApiSessionAuthenticated,
} from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { ShippingService } from './persistence/shipping.service';
import {
  ShippingConfigurationResponseDto,
  ShippingMethodResponseDto,
  ShippingRateRuleResponseDto,
  ShippingZoneResponseDto,
} from './shipping.dto';

class CreateZoneDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name!: string;
  @ApiProperty({ example: 'US', maxLength: 2, minLength: 2 })
  @IsString()
  @Length(2, 2)
  country!: string;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;
  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalPrefix?: string;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
class UpdateZoneDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;
  @ApiPropertyOptional({ maxLength: 2, minLength: 2 })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  province?: string;
  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalPrefix?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
class CreateMethodDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @Length(1, 160)
  title!: string;
  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  position?: number;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
class UpdateMethodDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  title?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  position?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
class RateRuleDto {
  @ApiProperty({ example: '0.00' })
  @IsString()
  minimumSubtotal!: string;
  @ApiPropertyOptional({ example: '100.00', nullable: true })
  @IsOptional()
  @IsString()
  maximumSubtotal?: string;
  @ApiProperty({ example: '5.00' })
  @IsString()
  amount!: string;
  @ApiProperty({ example: 'USD', maxLength: 3, minLength: 3 })
  @IsString()
  @Length(3, 3)
  currency!: string;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

@AdminApi()
@ApiTags('Shipping administration')
@ApiSessionAuthenticated()
@Controller('admin/shipping')
export class ShippingAdminController {
  constructor(
    private readonly shipping: ShippingService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @RequirePermissions(PermissionKey.SHIPPING_READ)
  @ApiOkResponse({ type: ShippingConfigurationResponseDto })
  list() {
    return this.shipping.listConfiguration();
  }

  @Post('zones')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  @ApiCreatedResponse({ type: ShippingZoneResponseDto })
  createZone(@Req() request: Request, @Body() dto: CreateZoneDto) {
    return this.shipping.createZone(
      dto,
      request.authUser!.id,
      this.requestId(),
    );
  }

  @Patch('zones/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  @ApiOkResponse({ type: ShippingZoneResponseDto })
  updateZone(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
    @Body() dto: UpdateZoneDto,
  ) {
    return this.shipping.updateZone(
      id,
      dto,
      request.authUser!.id,
      this.requestId(),
    );
  }

  @Delete('zones/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteZone(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ) {
    return this.shipping.deleteZone(id, request.authUser!.id, this.requestId());
  }

  @Post('zones/:zoneId/methods')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  @ApiCreatedResponse({ type: ShippingMethodResponseDto })
  createMethod(
    @Param('zoneId', new ParseUUIDPipe({ version: '4' })) zoneId: string,
    @Req() request: Request,
    @Body() dto: CreateMethodDto,
  ) {
    return this.shipping.createMethod(
      zoneId,
      dto,
      request.authUser!.id,
      this.requestId(),
    );
  }

  @Patch('methods/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  @ApiOkResponse({ type: ShippingMethodResponseDto })
  updateMethod(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
    @Body() dto: UpdateMethodDto,
  ) {
    return this.shipping.updateMethod(
      id,
      dto,
      request.authUser!.id,
      this.requestId(),
    );
  }

  @Delete('methods/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteMethod(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ) {
    return this.shipping.deleteMethod(
      id,
      request.authUser!.id,
      this.requestId(),
    );
  }

  @Post('methods/:methodId/rules')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  @ApiCreatedResponse({ type: ShippingRateRuleResponseDto })
  createRule(
    @Param('methodId', new ParseUUIDPipe({ version: '4' })) methodId: string,
    @Req() request: Request,
    @Body() dto: RateRuleDto,
  ) {
    return this.shipping.createRule(
      methodId,
      dto,
      request.authUser!.id,
      this.requestId(),
    );
  }

  @Patch('rules/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  @ApiOkResponse({ type: ShippingRateRuleResponseDto })
  updateRule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
    @Body() dto: RateRuleDto,
  ) {
    return this.shipping.updateRule(
      id,
      dto,
      request.authUser!.id,
      this.requestId(),
    );
  }

  @Delete('rules/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteRule(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: Request,
  ) {
    return this.shipping.deleteRule(id, request.authUser!.id, this.requestId());
  }

  private requestId(): string | null {
    return this.requestContext.getRequestId() ?? null;
  }
}
