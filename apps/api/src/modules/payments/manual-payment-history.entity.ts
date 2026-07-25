import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ManualPaymentStatus } from './manual-payment.entity';

@Entity({ name: 'manual_payment_history' })
@Index(['paymentId', 'createdAt'])
export class ManualPaymentHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId!: string;

  @Column({ name: 'from_status', type: 'varchar', length: 32, nullable: true })
  fromStatus!: ManualPaymentStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 32 })
  toStatus!: ManualPaymentStatus;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'safe_reference', type: 'varchar', length: 160, nullable: true })
  safeReference!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
