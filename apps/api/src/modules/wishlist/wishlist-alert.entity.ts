import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum WishlistAlertStatus {
  PENDING = 'pending',
  SENT = 'sent',
}

@Entity({ name: 'wishlist_availability_alerts' })
@Index('UQ_wishlist_alert_user_variant_episode', ['userId', 'variantId', 'episodeKey'], { unique: true })
export class WishlistAlert {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ name: 'episode_key', type: 'varchar', length: 96 })
  episodeKey!: string;

  @Column({ type: 'varchar', length: 16, default: WishlistAlertStatus.PENDING })
  status!: WishlistAlertStatus;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
