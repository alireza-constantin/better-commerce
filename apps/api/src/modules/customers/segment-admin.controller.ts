import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString, MaxLength } from 'class-validator';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PermissionKey } from '../authorization/data';
import { SegmentService } from './segment.service';

class CreateSegmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsObject()
  filters!: Record<string, unknown>;
}

@AdminApi()
@ApiTags('Customer segments')
@ApiSessionAuthenticated()
@Controller('admin/customers/segments')
export class SegmentAdminController {
  constructor(private readonly segments: SegmentService) {}

  @Get()
  @RequirePermissions(PermissionKey.CUSTOMERS_READ)
  @ApiOkResponse()
  list() { return this.segments.list(); }

  @Post()
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CUSTOMERS_READ, PermissionKey.COMMUNICATIONS_WRITE)
  @ApiCreatedResponse()
  create(@Body() dto: CreateSegmentDto) { return this.segments.create(dto.name, dto.filters); }
}
