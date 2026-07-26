import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ManualPaymentMethod } from '../payments';

export enum CommerceOrderStatus {
  SUBMITTED = 'submitted',
  ACCEPTED = 'accepted',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity({ name: 'commerce_orders' })
@Index(['userId', 'idempotencyKey'], { unique: true })
@Index(['status', 'submittedAt'])
@Check(
  'CHK_commerce_orders_amounts',
  'merchandise_subtotal_minor >= 0 AND shipping_minor >= 0 AND grand_total_minor >= 0',
)
export class CommerceOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    name: 'order_number',
    type: 'bigint',
    generated: 'increment',
    unique: true,
  })
  orderNumber!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 24 })
  status!: CommerceOrderStatus;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'merchandise_subtotal_minor', type: 'bigint' })
  merchandiseSubtotalMinor!: string;

  @Column({ name: 'shipping_minor', type: 'bigint' })
  shippingMinor!: string;

  @Column({ name: 'grand_total_minor', type: 'bigint' })
  grandTotalMinor!: string;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 120 })
  idempotencyKey!: string;

  @Column({ name: 'request_fingerprint', type: 'char', length: 64 })
  requestFingerprint!: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 32 })
  paymentMethod!: ManualPaymentMethod;

  @Column({ name: 'reservation_ids', type: 'jsonb' })
  reservationIds!: string[];

  @Column({ name: 'shipping_zone_id', type: 'uuid' })
  shippingZoneId!: string;

  @Column({ name: 'shipping_method_id', type: 'uuid' })
  shippingMethodId!: string;

  @Column({ name: 'shipping_rule_id', type: 'uuid' })
  shippingRuleId!: string;

  @Column({ name: 'shipping_method_title', type: 'varchar', length: 160 })
  shippingMethodTitle!: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 160 })
  recipientName!: string;

  @Column({ type: 'varchar', length: 40 })
  phone!: string;

  @Column({ type: 'varchar', length: 2 })
  country!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  province!: string | null;

  @Column({ type: 'varchar', length: 120 })
  city!: string;

  @Column({ type: 'varchar', length: 240 })
  line1!: string;

  @Column({ type: 'varchar', length: 240, nullable: true })
  line2!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 32 })
  postalCode!: string;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'decision_actor_user_id', type: 'uuid', nullable: true })
  decisionActorUserId!: string | null;

  @Column({
    name: 'decision_note',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  decisionNote!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
