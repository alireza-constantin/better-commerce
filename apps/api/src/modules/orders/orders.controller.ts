import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { RequestContextService } from '../../platform/observability';
import {
  ApiCsrfProtected,
  ApiProblemResponse,
  ApiSessionAuthenticated,
} from '../../platform/openapi';
import { PermissionKey } from '../authorization/data';
import { AdminApi, RequirePermissions } from '../authorization/enforcement';
import { formatMoney } from '../pricing';
import {
  ConfirmManualPaymentDto,
  ManualPaymentResponseDto,
  OrderDecisionDto,
  OrderResponseDto,
  OrdersPageResponseDto,
  OrdersQueryDto,
  SubmitOrderDto,
  SubmitCartOrderDto,
} from './orders.dto';
import { OrdersService } from './orders.service';
import { CartError } from '../cart';

function orderError(error: unknown): never {
  if (error instanceof CartError) {
    throw new HttpException(
      {
        message: error.message,
        code: error.code,
        ...(error.currentVersion === undefined
          ? {}
          : { currentVersion: error.currentVersion }),
      },
      error.code === 'cart.not_found'
        ? HttpStatus.NOT_FOUND
        : error.code === 'cart.checkout_requires_authentication'
          ? HttpStatus.UNAUTHORIZED
          : HttpStatus.CONFLICT,
    );
  }
  if (!(error instanceof Error)) throw error;
  if (error.message.includes('not found'))
    throw new NotFoundException(error.message);
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
  constructor(
    private readonly orders: OrdersService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('checkout/cart-orders')
  @ApiCsrfProtected()
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    description:
      'Caller-generated key. Replaying the same key and body returns the original order.',
    required: true,
    schema: { type: 'string', maxLength: 120 },
  })
  @ApiProblemResponse(400, 'The checkout request is invalid.')
  @ApiProblemResponse(409, 'The Cart or commerce state changed.')
  @ApiOperation({ summary: 'Submit an authenticated Cart for manual review' })
  async submitCart(
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: SubmitCartOrderDto,
  ) {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey || normalizedKey.length > 120) {
      throw new BadRequestException(
        'A valid Idempotency-Key header is required',
      );
    }
    try {
      return await this.orders.submitCart(
        request.authUser!.id,
        normalizedKey,
        dto,
        this.requestContext.getRequestId() ?? null,
      );
    } catch (error) {
      orderError(error);
    }
  }

  @Post('checkout/orders')
  @ApiCsrfProtected()
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiHeader({
    name: 'Idempotency-Key',
    description:
      'Caller-generated key. Replaying the same key and body returns the original order.',
    required: true,
    schema: { type: 'string', maxLength: 120 },
  })
  @ApiProblemResponse(
    400,
    'The checkout request or idempotency key is invalid.',
  )
  @ApiProblemResponse(
    409,
    'The order cannot be submitted in the current state.',
  )
  @ApiOperation({ summary: 'Submit an idempotent order for manual review' })
  async submit(
    @Req() request: Request,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: SubmitOrderDto,
  ) {
    const normalizedKey = idempotencyKey?.trim();
    if (!normalizedKey || normalizedKey.length > 120)
      throw new BadRequestException(
        'A valid Idempotency-Key header is required',
      );
    try {
      return await this.orders.submit(
        request.authUser!.id,
        normalizedKey,
        dto,
        this.requestContext.getRequestId() ?? null,
      );
    } catch (error) {
      orderError(error);
    }
  }

  @Get('orders')
  @ApiOkResponse({ type: OrdersPageResponseDto })
  @ApiProblemResponse(400, 'The cursor or page limit is invalid.')
  async list(@Req() request: Request, @Query() query: OrdersQueryDto) {
    try {
      return await this.orders.listForCustomer(request.authUser!.id, query);
    } catch (error) {
      orderError(error);
    }
  }

  @Get('orders/:orderId')
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiProblemResponse(404, 'The order does not exist for this customer.')
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
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  @RequirePermissions(PermissionKey.ORDERS_READ)
  @ApiOkResponse({ type: OrdersPageResponseDto })
  @ApiProblemResponse(400, 'The cursor or page limit is invalid.')
  async list(@Query() query: OrdersQueryDto) {
    try {
      return await this.orders.listForAdmin(query);
    } catch (error) {
      orderError(error);
    }
  }

  @Get(':orderId')
  @RequirePermissions(PermissionKey.ORDERS_READ)
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiProblemResponse(404, 'The order was not found.')
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
  @ApiCreatedResponse({ type: ManualPaymentResponseDto })
  @ApiProblemResponse(400, 'The payment confirmation is invalid.')
  @ApiProblemResponse(404, 'The order or payment was not found.')
  @ApiProblemResponse(
    409,
    'The payment cannot be confirmed in its current state.',
  )
  async confirmPayment(
    @Req() request: Request,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: ConfirmManualPaymentDto,
  ) {
    try {
      const payment = await this.orders.confirmManualPayment(
        orderId,
        request.authUser!.id,
        dto.reference,
        dto.note,
        this.requestContext.getRequestId() ?? null,
      );
      return {
        ...payment,
        expectedAmount: formatMoney(payment.expectedAmount),
      };
    } catch (error) {
      orderError(error);
    }
  }

  @Post(':orderId/accept')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.ORDERS_ACCEPT)
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiProblemResponse(400, 'The order decision is invalid.')
  @ApiProblemResponse(404, 'The order was not found.')
  @ApiProblemResponse(409, 'The order cannot be accepted in its current state.')
  async accept(
    @Req() request: Request,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: OrderDecisionDto,
  ) {
    try {
      return await this.orders.accept(
        orderId,
        request.authUser!.id,
        dto.note,
        this.requestContext.getRequestId() ?? null,
      );
    } catch (error) {
      orderError(error);
    }
  }

  @Post(':orderId/reject')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.ORDERS_REJECT)
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiProblemResponse(400, 'The order decision is invalid.')
  @ApiProblemResponse(404, 'The order was not found.')
  @ApiProblemResponse(409, 'The order cannot be rejected in its current state.')
  async reject(
    @Req() request: Request,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() dto: OrderDecisionDto,
  ) {
    try {
      return await this.orders.reject(
        orderId,
        request.authUser!.id,
        dto.note,
        this.requestContext.getRequestId() ?? null,
      );
    } catch (error) {
      orderError(error);
    }
  }
}
