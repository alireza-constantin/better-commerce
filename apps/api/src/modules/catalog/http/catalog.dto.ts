import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
  MaxLength,
} from 'class-validator';

const PRODUCT_STATUSES = ['draft', 'published', 'archived'] as const;
const VARIANT_STATUSES = ['active', 'archived'] as const;
const FULFILLMENT = ['physical', 'digital', 'service'] as const;
const PUBLIC_AVAILABILITY = [
  'in_stock',
  'out_of_stock',
  'unavailable',
] as const;

export class CreateProductDto {
  @ApiProperty({ maxLength: 200, minLength: 1 })
  @IsString()
  title!: string;
  @ApiProperty({ maxLength: 160, minLength: 1 })
  @IsString()
  slug!: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  summary?: string | null;
  @ApiPropertyOptional({ maxLength: 50_000, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsString()
  defaultVariantTitle?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @IsString()
  defaultVariantSku?: string | null;
  @ApiProperty({ enum: FULFILLMENT })
  @IsIn(FULFILLMENT)
  fulfillmentClassification!: (typeof FULFILLMENT)[number];
}

export class EditProductDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
  @ApiProperty({ maxLength: 200, minLength: 1 })
  @IsString()
  title!: string;
  @ApiProperty({ maxLength: 160, minLength: 1 })
  @IsString()
  slug!: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  summary?: string | null;
  @ApiPropertyOptional({ maxLength: 50_000, nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;
}

export class OptionValueDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  id?: string;
  @ApiProperty({ maxLength: 100, minLength: 1 })
  @IsString()
  label!: string;
  @ApiProperty({ minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  position!: number;
}

export class ConfigurationOptionDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  id?: string;
  @ApiProperty({ maxLength: 100, minLength: 1 })
  @IsString()
  name!: string;
  @ApiProperty({ minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  position!: number;
  @ApiProperty({ type: () => [OptionValueDto], maxItems: 100 })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => OptionValueDto)
  values!: OptionValueDto[];
}

export class ConfigurationVariantDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  id?: string;
  @ApiProperty({ enum: VARIANT_STATUSES })
  @IsIn(VARIANT_STATUSES)
  status!: (typeof VARIANT_STATUSES)[number];
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsString()
  title?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @IsString()
  sku?: string | null;
  @ApiProperty({ minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  position!: number;
  @ApiProperty({ enum: FULFILLMENT })
  @IsIn(FULFILLMENT)
  fulfillmentClassification!: (typeof FULFILLMENT)[number];
  @ApiProperty({ type: [String], format: 'uuid', maxItems: 5 })
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  selectionValueIds!: string[];
  @ApiPropertyOptional({ format: 'uuid', type: [String], maxItems: 20 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  mediaIds?: string[];
}

export class ReplaceConfigurationDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
  @ApiProperty({ type: () => [ConfigurationOptionDto], maxItems: 5 })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ConfigurationOptionDto)
  options!: ConfigurationOptionDto[];
  @ApiProperty({ type: () => [ConfigurationVariantDto], maxItems: 500 })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ConfigurationVariantDto)
  variants!: ConfigurationVariantDto[];

  @ApiPropertyOptional({ type: () => [VariantPriceChangeDto], maxItems: 500 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => VariantPriceChangeDto)
  prices?: VariantPriceChangeDto[];

  @ApiPropertyOptional({
    type: () => [VariantInventoryChangeDto],
    maxItems: 500,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => VariantInventoryChangeDto)
  inventory?: VariantInventoryChangeDto[];
}

export class VariantPriceChangeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  variantId!: string;

  @ApiPropertyOptional({
    example: '120.00',
    pattern: '^\d+(?:\.\d+)?$',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  amount!: string | null;
}

export class VariantInventoryChangeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  variantId!: string;

  @ApiProperty({ enum: ['not_configured', 'tracked', 'untracked'] })
  @IsIn(['not_configured', 'tracked', 'untracked'])
  trackingMode!: 'not_configured' | 'tracked' | 'untracked';

  @ApiPropertyOptional({ minimum: 0, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  currentOnHand?: number | null;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reasonCode?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class ProductTransitionDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class UploadProductMediaDto {
  @ApiProperty({ minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional({ maxLength: 300, default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  altText?: string;

  @ApiProperty({ format: 'binary', type: 'string' })
  @Allow()
  file!: unknown;
}

export class ProductMediaItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id!: string;

  @ApiProperty({ maxLength: 300 })
  @IsString()
  @MaxLength(300)
  altText!: string;

  @ApiProperty({ minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  position!: number;
}

export class ReplaceProductMediaDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ maxItems: 20, type: () => [ProductMediaItemDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProductMediaItemDto)
  items!: ProductMediaItemDto[];
}

export class ProductMediaResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uri' })
  url!: string;
  @ApiProperty()
  altText!: string;
  @ApiProperty({ minimum: 0 })
  position!: number;
  @ApiProperty({ example: 'image/webp' })
  mediaType!: string;
  @ApiProperty({ minimum: 1 })
  width!: number;
  @ApiProperty({ minimum: 1 })
  height!: number;
}

export class AdminProductMediaResponseDto extends ProductMediaResponseDto {
  @ApiProperty({ minimum: 1 })
  byteSize!: number;
}

export class AdminProductQueryDto {
  @ApiPropertyOptional({ enum: PRODUCT_STATUSES })
  @IsOptional()
  @IsIn(PRODUCT_STATUSES)
  status?: (typeof PRODUCT_STATUSES)[number];
  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  sku?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class PublicProductQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreatedProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;
  @ApiProperty({ format: 'uuid' })
  variantId!: string;
  @ApiProperty({ minimum: 1 })
  version!: number;
}

export class ProductSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ minimum: 1 })
  version!: number;
  @ApiProperty({ enum: PRODUCT_STATUSES })
  status!: (typeof PRODUCT_STATUSES)[number];
  @ApiProperty()
  title!: string;
  @ApiProperty({ nullable: true, type: String })
  summary!: string | null;
  @ApiProperty({ nullable: true, type: String })
  description!: string | null;
  @ApiProperty()
  slug!: string;
  @ApiProperty()
  everPublished!: boolean;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  publishedAt!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  archivedAt!: string | null;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CatalogOptionValueResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  label!: string;
  @ApiProperty({ minimum: 0 })
  position!: number;
}

export class CatalogOptionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ minimum: 0 })
  position!: number;
  @ApiProperty({ type: () => [CatalogOptionValueResponseDto] })
  values!: CatalogOptionValueResponseDto[];
}

export class CatalogVariantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ enum: VARIANT_STATUSES })
  status!: (typeof VARIANT_STATUSES)[number];
  @ApiProperty({ nullable: true, type: String })
  title!: string | null;
  @ApiProperty({ nullable: true, type: String })
  sku!: string | null;
  @ApiProperty({ enum: FULFILLMENT })
  fulfillmentClassification!: (typeof FULFILLMENT)[number];
  @ApiProperty({ minimum: 0 })
  position!: number;
  @ApiProperty({ format: 'uuid', type: [String] })
  selectionValueIds!: string[];
  @ApiProperty({ format: 'uuid', type: [String] })
  mediaIds!: string[];
}

export class ProductDetailResponseDto extends ProductSummaryResponseDto {
  @ApiProperty({ format: 'uuid', type: [String] })
  categoryIds!: string[];
  @ApiProperty({ type: () => [AdminProductMediaResponseDto] })
  media!: AdminProductMediaResponseDto[];
  @ApiProperty({ type: () => [CatalogVariantResponseDto] })
  variants!: CatalogVariantResponseDto[];
  @ApiProperty({ type: () => [CatalogOptionResponseDto] })
  options!: CatalogOptionResponseDto[];
}

export class ProductPageResponseDto {
  @ApiProperty({ type: () => [ProductSummaryResponseDto] })
  items!: ProductSummaryResponseDto[];
  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class PublicCatalogVariantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ nullable: true, type: String })
  title!: string | null;
  @ApiProperty({ nullable: true, type: String })
  sku!: string | null;
  @ApiProperty({ enum: FULFILLMENT })
  fulfillmentClassification!: (typeof FULFILLMENT)[number];
  @ApiProperty({ minimum: 0 })
  position!: number;
  @ApiProperty({ format: 'uuid', type: [String] })
  selectionValueIds!: string[];
  @ApiProperty({ format: 'uuid', type: [String] })
  mediaIds!: string[];
  @ApiProperty({ nullable: true, type: () => PublicMoneyResponseDto })
  price!: PublicMoneyResponseDto | null;
  @ApiProperty({ enum: PUBLIC_AVAILABILITY })
  availability!: (typeof PUBLIC_AVAILABILITY)[number];
  @ApiProperty()
  purchasable!: boolean;
}

export class PublicMoneyResponseDto {
  @ApiProperty({ example: '120.00', pattern: '^\\d+(?:\\.\\d+)?$' })
  amount!: string;
  @ApiProperty({ example: 'USD', maxLength: 3, minLength: 3 })
  currency!: string;
}

export class PublicPriceRangeResponseDto {
  @ApiProperty({ type: () => PublicMoneyResponseDto })
  minimum!: PublicMoneyResponseDto;
  @ApiProperty({ type: () => PublicMoneyResponseDto })
  maximum!: PublicMoneyResponseDto;
  @ApiProperty()
  varies!: boolean;
}

export class PublicProductResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  title!: string;
  @ApiProperty({ nullable: true, type: String })
  summary!: string | null;
  @ApiProperty({ nullable: true, type: String })
  description!: string | null;
  @ApiProperty()
  slug!: string;
  @ApiProperty({ format: 'date-time' })
  publishedAt!: string;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
  @ApiProperty({ type: () => [ProductMediaResponseDto] })
  media!: ProductMediaResponseDto[];
  @ApiProperty({ type: () => [CatalogOptionResponseDto] })
  options!: CatalogOptionResponseDto[];
  @ApiProperty({ type: () => [PublicCatalogVariantResponseDto] })
  variants!: PublicCatalogVariantResponseDto[];
  @ApiProperty({ nullable: true, type: () => PublicPriceRangeResponseDto })
  priceRange!: PublicPriceRangeResponseDto | null;
  @ApiProperty({ enum: PUBLIC_AVAILABILITY })
  availability!: (typeof PUBLIC_AVAILABILITY)[number];
}

export class PublicProductPageResponseDto {
  @ApiProperty({ type: () => [PublicProductResponseDto] })
  items!: PublicProductResponseDto[];
  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class PublicProductResolutionResponseDto {
  @ApiProperty({ type: () => PublicProductResponseDto })
  product!: PublicProductResponseDto;
  @ApiProperty()
  canonicalSlug!: string;
  @ApiProperty()
  requestedSlugIsCanonical!: boolean;
}
