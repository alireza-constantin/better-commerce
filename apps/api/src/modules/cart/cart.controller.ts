import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../../platform/http/authentication';
import {
  ApiCsrfProtected,
  ApiProblemResponse,
  ApiSessionAuthenticated,
} from '../../platform/openapi';
import {
  CartCheckoutPreparationResponseDto,
  CartResponseDto,
  CartVersionDto,
  PrepareCartCheckoutDto,
  SetCartLineDto,
} from './cart.dto';
import { CartError } from './cart.error';
import { CartService } from './cart.service';
import { CartTokenService } from './cart-token.service';
import type { CartOwner } from './cart.types';

const statusByCode: Record<CartError['code'], HttpStatus> = {
  'cart.not_found': HttpStatus.NOT_FOUND,
  'cart.version_conflict': HttpStatus.CONFLICT,
  'cart.limit_exceeded': HttpStatus.UNPROCESSABLE_ENTITY,
  'cart.line_invalid': HttpStatus.UNPROCESSABLE_ENTITY,
  'cart.merge_conflict': HttpStatus.CONFLICT,
  'cart.checkout_requires_authentication': HttpStatus.UNAUTHORIZED,
};

function translateCartError(error: unknown): never {
  if (error instanceof CartError) {
    throw new HttpException(
      {
        message: error.message,
        code: error.code,
        ...(error.currentVersion === undefined
          ? {}
          : { currentVersion: error.currentVersion }),
      },
      statusByCode[error.code],
    );
  }
  throw error;
}

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(
    private readonly carts: CartService,
    private readonly tokens: CartTokenService,
  ) {}

  @Public()
  @Get()
  @ApiCookieAuth('sessionCookie')
  @ApiOkResponse({ type: CartResponseDto })
  @ApiOperation({ summary: 'Read the current anonymous or customer Cart' })
  async current(@Req() request: Request) {
    return this.carts.getCurrent(this.owner(request));
  }

  @Public()
  @Put('lines')
  @ApiCookieAuth('sessionCookie')
  @ApiCsrfProtected()
  @ApiOkResponse({ type: CartResponseDto })
  @ApiProblemResponse(409, 'cart.version_conflict')
  @ApiProblemResponse(422, 'cart.line_invalid or cart.limit_exceeded')
  async setLine(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: SetCartLineDto,
  ) {
    try {
      return await this.carts.setQuantity(
        this.ownerForMutation(request, response),
        dto.expectedVersion,
        dto.variantId,
        dto.quantity,
      );
    } catch (error) {
      translateCartError(error);
    }
  }

  @Public()
  @Post('lines/:lineId/remove')
  @ApiCookieAuth('sessionCookie')
  @ApiCsrfProtected()
  @ApiOkResponse({ type: CartResponseDto })
  async removeLine(
    @Req() request: Request,
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
    @Body() dto: CartVersionDto,
  ) {
    try {
      return await this.carts.removeLine(
        this.owner(request),
        dto.expectedVersion,
        lineId,
      );
    } catch (error) {
      translateCartError(error);
    }
  }

  @Public()
  @Post('clear')
  @ApiCookieAuth('sessionCookie')
  @ApiCsrfProtected()
  @ApiOkResponse({ type: CartResponseDto })
  async clear(@Req() request: Request, @Body() dto: CartVersionDto) {
    try {
      return await this.carts.clear(this.owner(request), dto.expectedVersion);
    } catch (error) {
      translateCartError(error);
    }
  }

  @Public()
  @Post('checkout-preparation')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('sessionCookie')
  @ApiCsrfProtected()
  @ApiOkResponse({ type: CartCheckoutPreparationResponseDto })
  @ApiProblemResponse(409, 'cart.version_conflict')
  @ApiProblemResponse(422, 'cart.line_invalid')
  @ApiOperation({
    summary: 'Calculate current eligible Shipping methods for the Cart',
  })
  async prepareCheckout(
    @Req() request: Request,
    @Body() dto: PrepareCartCheckoutDto,
  ) {
    try {
      return await this.carts.prepareCheckout(
        this.owner(request),
        dto.expectedVersion,
        dto.deliveryAddress,
        dto.promotionCode,
      );
    } catch (error) {
      translateCartError(error);
    }
  }

  @Post('claim')
  @ApiSessionAuthenticated()
  @ApiCsrfProtected()
  @ApiCreatedResponse({ type: CartResponseDto })
  @ApiProblemResponse(409, 'cart.merge_conflict or cart.version_conflict')
  async claim(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: CartVersionDto,
  ) {
    const digests = this.tokens.digests(this.readToken(request));
    if (!digests.length)
      return this.carts.getCurrent({ userId: request.authUser!.id });
    try {
      const cart = await this.carts.claim(
        request.authUser!.id,
        digests,
        dto.expectedVersion,
      );
      response.clearCookie(this.tokens.cookieName, this.cookieOptions());
      return cart;
    } catch (error) {
      translateCartError(error);
    }
  }

  private owner(request: Request): CartOwner {
    if (request.authUser) return { userId: request.authUser.id };
    const anonymousTokenDigests = this.tokens.digests(this.readToken(request));
    return anonymousTokenDigests.length ? { anonymousTokenDigests } : {};
  }

  private ownerForMutation(request: Request, response: Response): CartOwner {
    if (request.authUser) return { userId: request.authUser.id };
    const existing = this.owner(request);
    if (existing.anonymousTokenDigests?.length) return existing;
    const issued = this.tokens.issue();
    response.cookie(this.tokens.cookieName, issued.token, {
      ...this.cookieOptions(),
      maxAge: this.tokens.anonymousTtlMs,
    });
    return { anonymousTokenDigest: issued.digest };
  }

  private readToken(request: Request): string | undefined {
    const cookie = request.headers.cookie;
    if (!cookie) return undefined;
    for (const part of cookie.split(';')) {
      const separator = part.indexOf('=');
      if (separator < 0) continue;
      const name = part.slice(0, separator).trim();
      if (name === this.tokens.cookieName) {
        return decodeURIComponent(part.slice(separator + 1).trim());
      }
    }
    return undefined;
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.tokens.secure,
      path: '/',
    };
  }
}
