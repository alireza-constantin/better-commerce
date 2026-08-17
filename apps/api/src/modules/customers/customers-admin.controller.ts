import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiSessionAuthenticated } from '../../platform/openapi';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PermissionKey } from '../authorization/data';
import { UserStatus } from '../identity/persistence/user.entity';
import { CustomerDirectoryService } from './customer-directory.service';

class CustomerDirectoryQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

@AdminApi()
@ApiTags('Customer administration')
@ApiSessionAuthenticated()
@Controller('admin/customers')
export class CustomersAdminController {
  constructor(private readonly directory: CustomerDirectoryService) {}

  @Get()
  @RequirePermissions(PermissionKey.CUSTOMERS_READ)
  @ApiOkResponse()
  list(@Query() query: CustomerDirectoryQueryDto) {
    return this.directory.list(query);
  }

  @Get(':customerId')
  @RequirePermissions(PermissionKey.CUSTOMERS_READ)
  @ApiOkResponse()
  get(@Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string) {
    return this.directory.get(customerId);
  }
}
