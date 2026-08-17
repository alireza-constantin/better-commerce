import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DeliveryAttemptStatus } from './provider';

@Entity({ name: 'message_delivery_attempts' })
@Index('UQ_message_delivery_attempts_intent_attempt', ['intentId', 'attemptNumber'], { unique: true })
export class MessageDeliveryAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'intent_id', type: 'uuid' })
  intentId!: string;

  @Column({ name: 'attempt_number', type: 'integer' })
  attemptNumber!: number;

  @Column({ name: 'provider_key', type: 'varchar', length: 64 })
  providerKey!: string;

  @Column({ type: 'varchar', length: 24 })
  status!: DeliveryAttemptStatus;

  @Column({ name: 'external_message_id', type: 'varchar', length: 128, nullable: true })
  externalMessageId!: string | null;

  @Column({ name: 'outcome_code', type: 'varchar', length: 64, nullable: true })
  outcomeCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
