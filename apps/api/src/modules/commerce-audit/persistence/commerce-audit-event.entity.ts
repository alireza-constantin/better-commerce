import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  CommerceAuditAction,
  CommerceAuditMetadata,
} from '../commerce-audit.contract';

@Entity({ name: 'commerce_audit_events' })
@Check(
  'CHK_commerce_audit_events_metadata_object',
  "jsonb_typeof(metadata) = 'object'",
)
@Index(['createdAt'])
@Index(['actorUserId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['targetType', 'targetId'])
export class CommerceAuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'varchar', length: 100 })
  action!: CommerceAuditAction;

  @Column({ name: 'target_type', type: 'varchar', length: 100 })
  targetType!: string;

  @Column({ name: 'target_id', type: 'varchar', length: 255 })
  targetId!: string;

  @Column({ name: 'request_id', type: 'varchar', length: 128, nullable: true })
  requestId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: CommerceAuditMetadata;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
