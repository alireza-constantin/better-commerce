import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import {
  ApiCsrfProtected,
  ApiSessionAuthenticated,
} from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import {
  PAYMENTS_MODULE_CONTRACT,
  type PaymentsModuleContract,
} from '../payments';
import {
  ConfirmManualPaymentDto,
  OrderDecisionDto,
  SubmitOrderDto,
} from './orders.dto';
import { OrdersService } from './orders.service';

function orderError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  if (error.message.includes('not found')) throw new NotFoundException(error.message);
  if (
    error.message.includes('already') ||
    error.message.includes('unavailable') ||
    error.message.includes('Insufficient') ||
    error.message.includes('confirmed')
  )
    throw new ConflictException(error.message);
  throw new BadRequestException(error.message);
}

@ApiTags('Orders')
@ApiSessionAuthenticated()
@Controller()
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout/orders')
  @ApiCsrfProtected()
  @ApiCreatedResponse()
  @ApiOperation({ summary: 'Submit an idempotent order for manual review' })
  async submit(
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: SubmitOrderDto,
  ) {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey || normalizedKey.length > 120)
      throw new BadRequestException('A valid Idempotency-Key header is required');
    try {
      return await this.orders.submit(request.authUser!.id, normalizedKey, dto);
    } catch (error) {
      orderError(error);
    }
  }

  @Get('orders')
  list(@Req() request: Request) {
    return this.orders.listForCustomer(request.authUser!.id);
  }

  @Get('orders/:orderId')
  async detail(
    @Req() request: Request,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    try {
      return await this.orders.getForCustomer(request.authUser!.id, orderId);
    } catch (error) {
      orderError(error);
    }
  }
}

@AdminApi()
@ApiTags('Order administration')
@ApiSessionAuthenticated()
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    @Inject(PAYMENTS_MODULE_CONTRACT)
    private readonly payments: PaymentsModuleContract,
  ) {}

  @Get()
  @RequirePermissions(PermissionKey.ORDERS_READ)
  list() {
    return this.orders.listForAdmin();
  }

  @Get(':orderId')
  @RequirePermissions(PermissionKey.ORDERS_READ)
  async detail(
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    try {
      return await this.orders.getForAdmin(orderId);
    } catch (error) {
      orderError(error);
    }
  }

  @Post(':orderId/payment/confirm')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.PAYMENTS_MANUAL_CONFIRM)
  async confirmPayment(
    @Req() request: Request,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: ConfirmManualPaymentDto,
  ) {
    try {
      return await this.payments.confirmManualPayment(
        orderId,
        request.authUser!.id,
        dto.reference,
        dto.note,
      );
    } catch (error) {
      orderError(error);
    }
  }

  @Post(':orderId/accept')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.ORDERS_ACCEPT)
  async accept(
    @Req() request: Request,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: OrderDecisionDto,
  ) {
    try {
      return await this.orders.accept(orderId, request.authUser!.id, dto.note);
    } catch (error) {
      orderError(error);
    }
  }

  @Post(':orderId/reject')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.ORDERS_REJECT)
  async reject(
    @Req() request: Request,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: OrderDecisionDto,
  ) {
    try {
      return await this.orders.reject(orderId, request.authUser!.id, dto.note);
    } catch (error) {
      orderError(error);
    }
  }
}
