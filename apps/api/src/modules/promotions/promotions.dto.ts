import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PromotionRuleDto {
  @ApiProperty({ enum: ['percentage', 'fixed_amount'] })
  @IsIn(['percentage', 'fixed_amount'])
  kind!: 'percentage' | 'fixed_amount';

  @ApiPropertyOptional({ example: '15.00' })
  @IsOptional()
  @IsString()
  percentage?: string;

  @ApiPropertyOptional({ example: '20.00' })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional({ example: 'USD', minLength: 3, maxLength: 3 })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class PromotionTargetDto {
  @ApiProperty({ enum: ['cart', 'variants', 'categories', 'collections'] })
  @IsIn(['cart', 'variants', 'categories', 'collections'])
  kind!: 'cart' | 'variants' | 'categories' | 'collections';

  @ApiProperty({ type: [String], maxItems: 500 })
  @IsArray()
  @IsUUID('4', { each: true })
  ids!: string[];
}

export class PromotionDefinitionDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @Length(1, 160)
  name!: string;

  @ApiPropertyOptional({ maxLength: 2_000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string | null;

  @ApiProperty({ enum: ['public', 'code_required'] })
  @IsIn(['public', 'code_required'])
  eligibility!: 'public' | 'code_required';

  @ApiPropertyOptional({ maxLength: 64, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string | null;

  @ApiProperty({ type: () => PromotionRuleDto })
  @ValidateNested()
  @Type(() => PromotionRuleDto)
  rule!: PromotionRuleDto;

  @ApiProperty({ type: () => PromotionTargetDto })
  @ValidateNested()
  @Type(() => PromotionTargetDto)
  target!: PromotionTargetDto;

  @ApiProperty({ minimum: 0, maximum: 1_000_000 })
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  priority!: number;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 10_000_000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  totalLimit?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 1_000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000)
  perCustomerLimit?: number | null;
}

export class CreatePromotionDto extends PromotionDefinitionDto {}

export class ReplacePromotionDefinitionDto extends PromotionDefinitionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}

export class PromotionListQueryDto {
  @ApiPropertyOptional({
    enum: ['draft', 'scheduled', 'active', 'paused', 'ended'],
  })
  @IsOptional()
  @IsIn(['draft', 'scheduled', 'active', 'paused', 'ended'])
  status?: 'draft' | 'scheduled' | 'active' | 'paused' | 'ended';

  @ApiPropertyOptional({ maxLength: 160 })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}

export class PromotionRuleResponseDto {
  @ApiProperty({ enum: ['percentage', 'fixed_amount'] })
  kind!: string;

  @ApiPropertyOptional()
  percentage?: string;

  @ApiPropertyOptional({ type: Object })
  amount?: { amount: string; currency: string };
}

export class PromotionResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'uuid' }) definitionVersion!: string;
  @ApiProperty({ enum: ['draft', 'scheduled', 'active', 'paused', 'ended'] })
  status!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ enum: ['public', 'code_required'] }) eligibility!: string;
  @ApiProperty({ nullable: true, type: String }) code!: string | null;
  @ApiProperty({ type: () => PromotionRuleResponseDto })
  rule!: PromotionRuleResponseDto;
  @ApiProperty({ type: Object }) target!: { kind: string; ids: string[] };
  @ApiProperty() priority!: number;
  @ApiProperty({ format: 'date-time' }) startsAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) endsAt!:
    string | null;
  @ApiProperty({ nullable: true, type: Number }) totalLimit!: number | null;
  @ApiProperty({ nullable: true, type: Number }) perCustomerLimit!:
    number | null;
  @ApiProperty({ type: Object }) redemptions!: { total: number };
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class PromotionPageResponseDto {
  @ApiProperty({ type: () => [PromotionResponseDto] })
  items!: PromotionResponseDto[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}

export class PromotionRedemptionResponseDto {
  @ApiProperty({ type: Object })
  items!: unknown[];

  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
}
