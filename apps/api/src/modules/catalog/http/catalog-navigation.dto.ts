import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

const GROUPING_STATUSES = ['active', 'archived'] as const;

export class CatalogGroupingListQueryDto {
  @ApiPropertyOptional({ enum: GROUPING_STATUSES })
  @IsOptional()
  @IsIn(GROUPING_STATUSES)
  status?: (typeof GROUPING_STATUSES)[number];

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ maximum: 100, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 160, minLength: 1 })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ maxLength: 160, minLength: 1 })
  @IsString()
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  parentId?: string | null;

  @ApiProperty({ maximum: 499, minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  @Max(499)
  position!: number;
}

export class EditCategoryDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ maxLength: 160, minLength: 1 })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ maxLength: 160, minLength: 1 })
  @IsString()
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;
}

export class MoveCategoryDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  parentId!: string | null;

  @ApiProperty({ maximum: 499, minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  @Max(499)
  position!: number;
}

export class ReplaceProductCategoriesDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ format: 'uuid', maxItems: 20, type: [String] })
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds!: string[];
}

export class CreateCollectionDto {
  @ApiProperty({ maxLength: 160, minLength: 1 })
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty({ maxLength: 160, minLength: 1 })
  @IsString()
  @MaxLength(160)
  slug!: string;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string | null;

  @ApiPropertyOptional({ maxLength: 10_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;
}

export class EditCollectionDto extends CreateCollectionDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CatalogGroupingTransitionDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class CollectionProductItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ maximum: 999, minimum: 0, type: Number })
  @IsInt()
  @Min(0)
  @Max(999)
  position!: number;
}

export class ReplaceCollectionProductsDto {
  @ApiProperty({ minimum: 1, type: Number })
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @ApiProperty({ maxItems: 1_000, type: () => [CollectionProductItemDto] })
  @IsArray()
  @ArrayMaxSize(1_000)
  @ArrayUnique((item: CollectionProductItemDto) => item.productId)
  @ArrayUnique((item: CollectionProductItemDto) => item.position)
  @ValidateNested({ each: true })
  @Type(() => CollectionProductItemDto)
  items!: CollectionProductItemDto[];
}

export class CategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ enum: GROUPING_STATUSES })
  status!: (typeof GROUPING_STATUSES)[number];

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true, type: String })
  summary!: string | null;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  parentId!: string | null;

  @ApiProperty({ minimum: 0 })
  position!: number;

  @ApiProperty({ type: [String] })
  aliases!: string[];

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CategoryListResponseDto {
  @ApiProperty({ type: () => [CategoryResponseDto] })
  items!: CategoryResponseDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class CollectionProductMembershipResponseDto {
  @ApiProperty({ format: 'uuid' })
  productId!: string;

  @ApiProperty({ minimum: 0 })
  position!: number;
}

export class CollectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ minimum: 1 })
  version!: number;

  @ApiProperty({ enum: GROUPING_STATUSES })
  status!: (typeof GROUPING_STATUSES)[number];

  @ApiProperty()
  title!: string;

  @ApiProperty({ nullable: true, type: String })
  summary!: string | null;

  @ApiProperty({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ type: [String] })
  aliases!: string[];

  @ApiProperty({
    type: () => [CollectionProductMembershipResponseDto],
  })
  products!: CollectionProductMembershipResponseDto[];

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  archivedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class CollectionListResponseDto {
  @ApiProperty({ type: () => [CollectionResponseDto] })
  items!: CollectionResponseDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class PublicCategoryNavigationItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  parentId!: string | null;

  @ApiProperty({ minimum: 0 })
  position!: number;
}

export class PublicCategoryNavigationResponseDto {
  @ApiProperty({ maxItems: 500, type: () => [PublicCategoryNavigationItemDto] })
  items!: PublicCategoryNavigationItemDto[];
}

export class PublicCategoryResponseDto {
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

  @ApiProperty({
    type: () => [PublicCategoryNavigationItemDto],
  })
  breadcrumbs!: PublicCategoryNavigationItemDto[];
}

export class PublicCategoryResolutionResponseDto {
  @ApiProperty({ type: () => PublicCategoryResponseDto })
  category!: PublicCategoryResponseDto;

  @ApiProperty()
  canonicalSlug!: string;

  @ApiProperty()
  requestedSlugIsCanonical!: boolean;
}

export class PublicCollectionResponseDto {
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
}

export class PublicCollectionListResponseDto {
  @ApiProperty({ type: () => [PublicCollectionResponseDto] })
  items!: PublicCollectionResponseDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class PublicCollectionResolutionResponseDto {
  @ApiProperty({ type: () => PublicCollectionResponseDto })
  collection!: PublicCollectionResponseDto;

  @ApiProperty()
  canonicalSlug!: string;

  @ApiProperty()
  requestedSlugIsCanonical!: boolean;
}
