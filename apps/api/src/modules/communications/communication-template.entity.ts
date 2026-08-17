import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MessagePurpose } from './message-intent.entity';

@Entity({ name: 'communication_templates' })
@Index('UQ_communication_templates_key_version', ['key', 'version'], { unique: true })
export class CommunicationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'template_key', type: 'varchar', length: 96 })
  key!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ type: 'varchar', length: 32 })
  purpose!: MessagePurpose;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
