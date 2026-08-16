import { Check, Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { FulfillmentClassification } from '../catalog';

@Entity({ name: 'commerce_order_lines' })
@Index(['orderId'])
@Check('CHK_commerce_order_lines_quantity', 'quantity > 0')
@Check(
  'CHK_commerce_order_lines_amounts',
  'unit_minor >= 0 AND line_minor >= 0',
)
export class CommerceOrderLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ name: 'product_title', type: 'varchar', length: 240 })
  productTitle!: string;

  @Column({
    name: 'variant_title',
    type: 'varchar',
    length: 240,
    nullable: true,
  })
  variantTitle!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  sku!: string | null;

  @Column({ name: 'fulfillment_classification', type: 'varchar', length: 24 })
  fulfillmentClassification!: FulfillmentClassification;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ name: 'price_version_id', type: 'uuid' })
  priceVersionId!: string;

  @Column({ name: 'unit_minor', type: 'bigint' })
  unitMinor!: string;

  @Column({ name: 'line_minor', type: 'bigint' })
  lineMinor!: string;

  @Column({ name: 'discount_minor', type: 'bigint', default: '0' })
  discountMinor!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;
}
