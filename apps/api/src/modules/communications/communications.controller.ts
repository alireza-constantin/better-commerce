import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PermissionKey } from '../authorization/data';
import { CommunicationsService } from './communications.service';

class CreateTestMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;
}

@AdminApi()
@ApiTags('Communications administration')
@ApiSessionAuthenticated()
@Controller('admin/communications')
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Post('test-messages')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.COMMUNICATIONS_SEND)
  @ApiCreatedResponse()
  queueTestMessage(@Body() dto: CreateTestMessageDto) {
    return this.communications.queueTestMessage(dto);
  }

  @Get('messages/:messageId')
  @RequirePermissions(PermissionKey.COMMUNICATIONS_READ)
  getHistory(@Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string) {
    return this.communications.getHistory(messageId);
  }
}
