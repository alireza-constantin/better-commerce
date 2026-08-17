import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'communication_campaign_deliveries' })
@Index('UQ_campaign_deliveries_campaign_user', ['campaignId', 'userId'], { unique: true })
export class CampaignDelivery {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'campaign_id', type: 'uuid' }) campaignId!: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;
  @Column({ name: 'message_intent_id', type: 'uuid', nullable: true }) messageIntentId!: string | null;
  @Column({ type: 'varchar', length: 24 }) status!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
