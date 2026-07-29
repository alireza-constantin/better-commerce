import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../platform/http/authentication';
import { CatalogApplicationError } from '../catalog';
import {
  PublicProductPageResponseDto,
  PublicProductQueryDto,
  PublicProductResolutionResponseDto,
} from '../catalog/http/catalog.dto';
import { PublicCommerceService } from './public-commerce.service';

const catalogErrorStatus: Record<CatalogApplicationError['code'], HttpStatus> =
  {
    'catalog.validation_failed': HttpStatus.BAD_REQUEST,
    'catalog.not_found': HttpStatus.NOT_FOUND,
    'catalog.slug_conflict': HttpStatus.CONFLICT,
    'catalog.sku_conflict': HttpStatus.CONFLICT,
    'catalog.version_conflict': HttpStatus.CONFLICT,
    'catalog.invalid_product_transition': HttpStatus.CONFLICT,
    'catalog.configuration_conflict': HttpStatus.CONFLICT,
    'catalog.media_invalid': HttpStatus.BAD_REQUEST,
    'catalog.media_storage_failed': HttpStatus.SERVICE_UNAVAILABLE,
    'catalog.category_not_found': HttpStatus.NOT_FOUND,
    'catalog.collection_not_found': HttpStatus.NOT_FOUND,
    'catalog.category_slug_conflict': HttpStatus.CONFLICT,
    'catalog.collection_slug_conflict': HttpStatus.CONFLICT,
    'catalog.category_hierarchy_conflict': HttpStatus.CONFLICT,
    'catalog.category_transition_conflict': HttpStatus.CONFLICT,
    'catalog.collection_transition_conflict': HttpStatus.CONFLICT,
    'catalog.membership_conflict': HttpStatus.CONFLICT,
  };

@ApiTags('Catalog')
@Public()
@Controller('catalog')
export class PublicCommerceController {
  constructor(private readonly commerce: PublicCommerceService) {}

  @Get('products')
  @ApiOperation({
    summary: 'List published Products with display price and availability',
  })
  @ApiOkResponse({ type: PublicProductPageResponseDto })
  @ApiResponse({ status: 400, description: 'catalog.validation_failed' })
  async list(@Query() dto: PublicProductQueryDto) {
    try {
      return await this.commerce.listProducts(dto);
    } catch (error) {
      translateCatalogError(error);
    }
  }

  @Get('products/:slug')
  @ApiOperation({
    summary: 'Resolve a published Product with display commerce projections',
  })
  @ApiOkResponse({ type: PublicProductResolutionResponseDto })
  @ApiNotFoundResponse({
    description:
      'catalog.not_found; hidden, archived, draft, and unknown Products are indistinguishable.',
  })
  async detail(@Param('slug') slug: string) {
    try {
      return await this.commerce.resolveProduct(slug);
    } catch (error) {
      translateCatalogError(error);
    }
  }
}

function translateCatalogError(error: unknown): never {
  if (error instanceof CatalogApplicationError) {
    throw new HttpException(
      {
        message: error.message,
        code: error.code,
        ...(error.currentVersion === undefined
          ? {}
          : { currentVersion: error.currentVersion }),
      },
      catalogErrorStatus[error.code],
    );
  }
  throw error;
}
