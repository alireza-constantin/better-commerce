import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsArray, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PermissionKey } from '../authorization/data';
import { CampaignAudienceType } from './campaign.entity';
import { CampaignService } from './campaign.service';

class CreateCampaignDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsEnum(CampaignAudienceType) audienceType!: CampaignAudienceType;
  @IsString() @IsNotEmpty() @MaxLength(500) body!: string;
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) audienceUserIds?: string[];
  @IsOptional() @IsUUID() segmentId?: string;
  @IsOptional() @IsISO8601() scheduledAt?: string;
}

@AdminApi()
@ApiTags('Communication campaigns')
@ApiSessionAuthenticated()
@Controller('admin/communications/campaigns')
export class CampaignAdminController {
  constructor(private readonly campaigns: CampaignService) {}
  @Get() @RequirePermissions(PermissionKey.COMMUNICATIONS_READ) @ApiOkResponse() list() { return this.campaigns.list(); }
  @Post() @ApiCsrfProtected() @RequirePermissions(PermissionKey.COMMUNICATIONS_WRITE) @ApiCreatedResponse() create(@Body() dto: CreateCampaignDto) { return this.campaigns.create(dto); }
  @Post(':campaignId/confirm') @ApiCsrfProtected() @RequirePermissions(PermissionKey.COMMUNICATIONS_WRITE, PermissionKey.COMMUNICATIONS_SEND) @ApiOkResponse() confirm(@Param('campaignId', new ParseUUIDPipe({ version: '4' })) id: string) { return this.campaigns.confirm(id); }
}
