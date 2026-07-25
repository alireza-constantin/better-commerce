import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { ShippingService } from './shipping.service';

class CreateZoneDto {
  @IsString() @Length(1, 120) name!: string;
  @IsString() @Length(2, 2) country!: string;
  @IsOptional() @IsString() @MaxLength(120) province?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(20) postalPrefix?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class UpdateZoneDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsString() @Length(2, 2) country?: string;
  @IsOptional() @IsString() @MaxLength(120) province?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  @IsOptional() @IsString() @MaxLength(20) postalPrefix?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
class CreateMethodDto {
  @IsString() @Length(1, 160) title!: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
class UpdateMethodDto {
  @IsOptional() @IsString() @Length(1, 160) title?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
class RateRuleDto {
  @IsString() minimumSubtotal!: string;
  @IsOptional() @IsString() maximumSubtotal?: string;
  @IsString() amount!: string;
  @IsString() @Length(3, 3) currency!: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@AdminApi()
@ApiTags('Shipping administration')
@ApiSessionAuthenticated()
@Controller('admin/shipping')
export class ShippingAdminController {
  constructor(private readonly shipping: ShippingService) {}

  @Get()
  @RequirePermissions(PermissionKey.SHIPPING_READ)
  list() { return this.shipping.listConfiguration(); }

  @Post('zones')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  createZone(@Body() dto: CreateZoneDto) { return this.shipping.createZone(dto); }

  @Patch('zones/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  updateZone(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateZoneDto) {
    return this.shipping.updateZone(id, dto);
  }

  @Delete('zones/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  deleteZone(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.shipping.deleteZone(id);
  }

  @Post('zones/:zoneId/methods')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  createMethod(@Param('zoneId', new ParseUUIDPipe({ version: '4' })) zoneId: string, @Body() dto: CreateMethodDto) {
    return this.shipping.createMethod(zoneId, dto);
  }

  @Patch('methods/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  updateMethod(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateMethodDto) {
    return this.shipping.updateMethod(id, dto);
  }

  @Delete('methods/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  deleteMethod(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.shipping.deleteMethod(id);
  }

  @Post('methods/:methodId/rules')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  createRule(@Param('methodId', new ParseUUIDPipe({ version: '4' })) methodId: string, @Body() dto: RateRuleDto) {
    return this.shipping.createRule(methodId, dto);
  }

  @Patch('rules/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  updateRule(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: RateRuleDto) {
    return this.shipping.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.SHIPPING_WRITE)
  deleteRule(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.shipping.deleteRule(id);
  }
}
