import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PermissionKey } from '../authorization/data';
import { CommunicationsService } from './communications.service';
import { MessagePurpose } from './message-intent.entity';

class CreateTestMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;
}

class ConfigureRouteDto {
  @IsString()
  @IsNotEmpty()
  providerKey!: string;

  @IsBoolean()
  enabled!: boolean;
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

  @Get('routes')
  @RequirePermissions(PermissionKey.COMMUNICATIONS_READ)
  listRoutes() {
    return this.communications.listRoutes();
  }

  @Put('routes/:purpose')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.COMMUNICATIONS_CONFIGURE)
  configureRoute(
    @Param('purpose') purpose: MessagePurpose,
    @Body() dto: ConfigureRouteDto,
  ) {
    if (!Object.values(MessagePurpose).includes(purpose)) {
      throw new BadRequestException('Unsupported message purpose');
    }
    return this.communications.configureRoute(purpose, dto.providerKey, dto.enabled);
  }

  @Get('messages/:messageId')
  @RequirePermissions(PermissionKey.COMMUNICATIONS_READ)
  getHistory(@Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string) {
    return this.communications.getHistory(messageId);
  }
}
