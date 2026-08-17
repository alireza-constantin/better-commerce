import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import type { Request } from 'express';
import { ApiCsrfProtected, ApiSessionAuthenticated } from '../../platform/openapi';
import { WishlistService } from './wishlist.service';

class WishlistItemDto {
  @IsUUID()
  variantId!: string;
}

@ApiTags('Customer wishlist')
@ApiSessionAuthenticated()
@Controller('customer/wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  @ApiOkResponse()
  list(@Req() request: Request) {
    return this.wishlist.list(request.authUser!.id);
  }

  @Post('items')
  @ApiCsrfProtected()
  @ApiCreatedResponse()
  add(@Body() dto: WishlistItemDto, @Req() request: Request) {
    return this.wishlist.add(request.authUser!.id, dto.variantId);
  }

  @Delete('items/:variantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCsrfProtected()
  @ApiNoContentResponse()
  async remove(
    @Param('variantId', new ParseUUIDPipe({ version: '4' })) variantId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.wishlist.remove(request.authUser!.id, variantId);
  }
}
