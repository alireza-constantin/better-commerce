import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PermissionKey } from '../authorization/data';
import { MessagePurpose } from './message-intent.entity';
import { TemplateService } from './template.service';

class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(96)
  key!: string;

  @IsEnum(MessagePurpose)
  purpose!: MessagePurpose;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;
}

@AdminApi()
@ApiTags('Communication templates')
@ApiSessionAuthenticated()
@Controller('admin/communications/templates')
export class TemplateAdminController {
  constructor(private readonly templates: TemplateService) {}

  @Get()
  @RequirePermissions(PermissionKey.COMMUNICATIONS_READ)
  @ApiOkResponse()
  list() {
    return this.templates.list();
  }

  @Post()
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.COMMUNICATIONS_WRITE)
  @ApiCreatedResponse()
  create(@Body() dto: CreateTemplateDto) {
    return this.templates.create(dto.key, dto.purpose, dto.body);
  }
}
