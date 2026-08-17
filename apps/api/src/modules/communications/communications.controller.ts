import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { PermissionKey } from '../authorization/data';
import { CommunicationsService } from './communications.service';
import { MessagePurpose } from './message-intent.entity';
import { User, UserStatus } from '../identity/persistence/user.entity';

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

class CreateDirectMessageDto {
  @IsUUID()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;

  @IsBoolean()
  confirmed!: boolean;
}

class CreateOrderMessageDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  orderId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  lifecycleEvent!: string;

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
  constructor(
    private readonly communications: CommunicationsService,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  @Post('test-messages')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.COMMUNICATIONS_SEND)
  @ApiCreatedResponse()
  queueTestMessage(@Body() dto: CreateTestMessageDto) {
    return this.communications.queueTestMessage(dto);
  }

  @Post('direct-messages')
  @ApiCsrfProtected()
  @RequirePermissions(
    PermissionKey.CUSTOMERS_READ,
    PermissionKey.COMMUNICATIONS_SEND,
  )
  @ApiCreatedResponse()
  async queueDirectMessage(@Body() dto: CreateDirectMessageDto) {
    if (!dto.confirmed) {
      throw new BadRequestException('Confirm the message before sending');
    }
    const customer = await this.users.findOneBy({ id: dto.customerId });
    if (!customer || customer.status !== UserStatus.ACTIVE || !customer.mobileVerifiedAt || !customer.mobile) {
      throw new NotFoundException('Customer does not have an available verified mobile');
    }
    return this.communications.queueDirectMessage(customer.id, customer.mobile, dto.body);
  }

  @Post('order-messages')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.ORDERS_READ, PermissionKey.COMMUNICATIONS_SEND)
  @ApiCreatedResponse()
  async queueOrderMessage(@Body() dto: CreateOrderMessageDto) {
    const customer = await this.users.findOneBy({ id: dto.customerId });
    if (!customer || customer.status !== UserStatus.ACTIVE || !customer.mobileVerifiedAt || !customer.mobile) {
      throw new NotFoundException('Customer does not have an available verified mobile');
    }
    return this.communications.queueTransactionalOrderMessage(
      customer.id,
      customer.mobile,
      dto.orderId,
      dto.lifecycleEvent,
      dto.body,
    );
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
