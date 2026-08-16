import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'promotion_redemptions' })
@Index('UQ_promotion_redemptions_order', ['promotionId', 'orderId'], {
  unique: true,
})
@Index('IDX_promotion_redemptions_customer', ['promotionId', 'customerId'])
export class PromotionRedemption {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'promotion_id', type: 'uuid' })
  promotionId!: string;

  @Column({ name: 'definition_version_id', type: 'uuid' })
  definitionVersionId!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @Column({ name: 'discount_minor_amount', type: 'bigint' })
  discountMinorAmount!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
