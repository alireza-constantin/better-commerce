import { Check, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'shipping_rate_rules' })
@Index('IDX_shipping_rate_rules_method_range', ['methodId', 'minimumSubtotal'])
@Check('CHK_shipping_rate_rules_minimum', 'minimum_subtotal >= 0')
@Check('CHK_shipping_rate_rules_amount', 'minor_amount >= 0')
export class ShippingRateRule {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'method_id', type: 'uuid' }) methodId!: string;
  @Column({ name: 'minimum_subtotal', type: 'bigint' }) minimumSubtotal!: string;
  @Column({ name: 'maximum_subtotal', type: 'bigint', nullable: true }) maximumSubtotal!: string | null;
  @Column({ name: 'minor_amount', type: 'bigint' }) minorAmount!: string;
  @Column({ type: 'varchar', length: 3 }) currency!: string;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
