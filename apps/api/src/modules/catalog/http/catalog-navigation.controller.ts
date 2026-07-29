import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiCsrfProtected,
  ApiSessionAuthenticated,
} from '../../../platform/openapi';
import { PermissionKey } from '../../authorization/data';
import { AdminApi, RequirePermissions } from '../../authorization/enforcement';
import { CatalogApplicationError } from '../application/catalog-application.error';
import { CatalogNavigationService } from '../application/catalog-navigation.service';
import { CatalogGroupingStatus } from '../persistence';
import {
  CatalogGroupingListQueryDto,
  CatalogGroupingTransitionDto,
  CreateCategoryDto,
  CreateCollectionDto,
  EditCategoryDto,
  EditCollectionDto,
  MoveCategoryDto,
  ReplaceCollectionProductsDto,
  ReplaceProductCategoriesDto,
} from './catalog-navigation.dto';

function audit(request: Request) {
  return {
    actorUserId: request.authorization?.userId ?? null,
    requestId: request.headers['x-request-id']?.toString() ?? null,
  };
}
function translate(error: unknown): never {
  if (error instanceof CatalogApplicationError)
    throw new HttpException(
      {
        message: error.message,
        code: error.code,
        ...(error.currentVersion
          ? { currentVersion: error.currentVersion }
          : {}),
      },
      error.code.includes('not_found')
        ? HttpStatus.NOT_FOUND
        : error.code === 'catalog.validation_failed'
          ? HttpStatus.BAD_REQUEST
          : HttpStatus.CONFLICT,
    );
  throw error;
}

@AdminApi()
@ApiSessionAuthenticated()
@Controller('admin/catalog')
export class CatalogNavigationAdminController {
  constructor(private readonly navigation: CatalogNavigationService) {}
  @Get('categories')
  @RequirePermissions(PermissionKey.CATALOG_CATEGORIES_READ)
  async categories(@Query() query: CatalogGroupingListQueryDto) {
    return this.call(() =>
      this.navigation.listAdminCategories({
        ...query,
        status: query.status as CatalogGroupingStatus | undefined,
      }),
    );
  }
  @Post('categories')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_CATEGORIES_WRITE)
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @Req() request: Request,
  ) {
    return this.call(() => this.navigation.createCategory(dto, audit(request)));
  }
  @Get('categories/:id')
  @RequirePermissions(PermissionKey.CATALOG_CATEGORIES_READ)
  async category(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.call(() => this.navigation.getAdminCategory(id));
  }
  @Patch('categories/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_CATEGORIES_WRITE)
  async editCategory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: EditCategoryDto,
    @Req() request: Request,
  ) {
    return this.call(() =>
      this.navigation.editCategory(id, dto, audit(request)),
    );
  }
  @Post('categories/:id/move')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_CATEGORIES_WRITE)
  async moveCategory(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: MoveCategoryDto,
    @Req() request: Request,
  ) {
    return this.call(() =>
      this.navigation.moveCategory(id, dto, audit(request)),
    );
  }
  @Post('categories/:id/:action')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_CATEGORIES_WRITE)
  async categoryTransition(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('action') action: 'archive' | 'restore',
    @Body() dto: CatalogGroupingTransitionDto,
    @Req() request: Request,
  ) {
    if (action !== 'archive' && action !== 'restore')
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return this.call(() =>
      action === 'archive'
        ? this.navigation.archiveCategory(
            id,
            dto.expectedVersion,
            audit(request),
          )
        : this.navigation.restoreCategory(
            id,
            dto.expectedVersion,
            audit(request),
          ),
    );
  }
  @Put('products/:id/categories')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_PRODUCTS_WRITE)
  async productCategories(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReplaceProductCategoriesDto,
    @Req() request: Request,
  ) {
    return this.call(() =>
      this.navigation.replaceProductCategories(
        id,
        { expectedVersion: dto.expectedVersion, ids: dto.categoryIds },
        audit(request),
      ),
    );
  }
  @Get('collections')
  @RequirePermissions(PermissionKey.CATALOG_COLLECTIONS_READ)
  async collections(@Query() query: CatalogGroupingListQueryDto) {
    return this.call(() =>
      this.navigation.listAdminCollections({
        ...query,
        status: query.status as CatalogGroupingStatus | undefined,
      }),
    );
  }
  @Post('collections')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_COLLECTIONS_WRITE)
  async createCollection(
    @Body() dto: CreateCollectionDto,
    @Req() request: Request,
  ) {
    return this.call(() =>
      this.navigation.createCollection(dto, audit(request)),
    );
  }
  @Get('collections/:id')
  @RequirePermissions(PermissionKey.CATALOG_COLLECTIONS_READ)
  async collection(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.call(() => this.navigation.getAdminCollection(id));
  }
  @Patch('collections/:id')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_COLLECTIONS_WRITE)
  async editCollection(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: EditCollectionDto,
    @Req() request: Request,
  ) {
    return this.call(() =>
      this.navigation.editCollection(id, dto, audit(request)),
    );
  }
  @Put('collections/:id/products')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_COLLECTIONS_WRITE)
  async collectionProducts(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: ReplaceCollectionProductsDto,
    @Req() request: Request,
  ) {
    return this.call(() =>
      this.navigation.replaceCollectionProducts(
        id,
        dto.expectedVersion,
        dto.items,
        audit(request),
      ),
    );
  }
  @Post('collections/:id/:action')
  @ApiCsrfProtected()
  @RequirePermissions(PermissionKey.CATALOG_COLLECTIONS_WRITE)
  async collectionTransition(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('action') action: 'archive' | 'restore',
    @Body() dto: CatalogGroupingTransitionDto,
    @Req() request: Request,
  ) {
    if (action !== 'archive' && action !== 'restore')
      throw new HttpException('Not found', HttpStatus.NOT_FOUND);
    return this.call(() =>
      action === 'archive'
        ? this.navigation.archiveCollection(
            id,
            dto.expectedVersion,
            audit(request),
          )
        : this.navigation.restoreCollection(
            id,
            dto.expectedVersion,
            audit(request),
          ),
    );
  }
  private async call<T>(work: () => Promise<T>) {
    try {
      return await work();
    } catch (error) {
      translate(error);
    }
  }
}
