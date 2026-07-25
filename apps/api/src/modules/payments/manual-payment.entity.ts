import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ManualPaymentMethod {
  CASH_ON_DELIVERY = 'cash_on_delivery',
  CASH_ON_PICKUP = 'cash_on_pickup',
  BANK_TRANSFER = 'bank_transfer',
}

export enum ManualPaymentStatus {
  PENDING_MANUAL_REVIEW = 'pending_manual_review',
  PENDING_COLLECTION = 'pending_collection',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'manual_payments' })
@Check('CHK_manual_payments_amount', 'expected_minor_amount >= 0')
export class ManualPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'uuid', unique: true })
  orderId!: string;

  @Column({ type: 'varchar', length: 32 })
  method!: ManualPaymentMethod;

  @Column({ type: 'varchar', length: 32 })
  status!: ManualPaymentStatus;

  @Column({ name: 'expected_minor_amount', type: 'bigint' })
  expectedMinorAmount!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
