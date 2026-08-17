import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum CampaignStatus { DRAFT = 'draft', SCHEDULED = 'scheduled', SENDING = 'sending', COMPLETED = 'completed', CANCELLED = 'cancelled' }
export enum CampaignAudienceType { INDIVIDUAL = 'individual', ALL_MESSAGEABLE = 'all_messageable', SAVED_SEGMENT = 'saved_segment' }

@Entity({ name: 'communication_campaigns' })
export class CommunicationCampaign {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 120 }) name!: string;
  @Column({ type: 'varchar', length: 16, default: CampaignStatus.DRAFT }) status!: CampaignStatus;
  @Column({ name: 'audience_type', type: 'varchar', length: 24 }) audienceType!: CampaignAudienceType;
  @Column({ name: 'audience_user_ids', type: 'jsonb', nullable: true }) audienceUserIds!: string[] | null;
  @Column({ name: 'segment_id', type: 'uuid', nullable: true }) segmentId!: string | null;
  @Column({ type: 'text' }) body!: string;
  @Column({ name: 'scheduled_at', type: 'timestamptz', nullable: true }) scheduledAt!: Date | null;
  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true }) confirmedAt!: Date | null;
  @Column({ name: 'frozen_provider_key', type: 'varchar', length: 64, nullable: true }) frozenProviderKey!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
