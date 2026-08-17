import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MessagePurpose {
  TEST = 'test',
  AUTHENTICATION = 'authentication',
  TRANSACTIONAL = 'transactional',
  DIRECT = 'direct',
  CAMPAIGN = 'campaign',
  WISHLIST = 'wishlist',
}

export enum MessageIntentStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  ACCEPTED = 'accepted',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  UNKNOWN = 'unknown',
}

@Entity({ name: 'message_intents' })
@Index('IDX_message_intents_status_created_at', ['status', 'createdAt'])
export class MessageIntent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  purpose!: MessagePurpose;

  @Column({ name: 'recipient_user_id', type: 'uuid', nullable: true })
  recipientUserId!: string | null;

  @Column({ name: 'destination', type: 'varchar', length: 32 })
  destination!: string;

  @Column({ name: 'rendered_body', type: 'text' })
  renderedBody!: string;

  @Column({ name: 'provider_key', type: 'varchar', length: 64 })
  providerKey!: string;

  @Column({ type: 'varchar', length: 24, default: MessageIntentStatus.QUEUED })
  status!: MessageIntentStatus;

  @Column({ name: 'last_error_code', type: 'varchar', length: 64, nullable: true })
  lastErrorCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
