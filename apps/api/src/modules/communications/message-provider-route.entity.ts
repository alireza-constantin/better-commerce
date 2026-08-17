import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MessagePurpose } from './message-intent.entity';

@Entity({ name: 'message_provider_routes' })
@Index('UQ_message_provider_routes_purpose', ['purpose'], { unique: true })
export class MessageProviderRoute {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  purpose!: MessagePurpose;

  @Column({ name: 'provider_key', type: 'varchar', length: 64 })
  providerKey!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
