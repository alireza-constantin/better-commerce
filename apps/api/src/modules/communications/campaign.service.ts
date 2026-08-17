import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CampaignAudienceType, CampaignStatus, CommunicationCampaign } from './campaign.entity';
import { CampaignDelivery } from './campaign-delivery.entity';
import { User, UserStatus } from '../identity/persistence/user.entity';
import { CommunicationsService } from './communications.service';

@Injectable()
export class CampaignService {
  constructor(
    @InjectRepository(CommunicationCampaign) private readonly campaigns: Repository<CommunicationCampaign>,
    @InjectRepository(CampaignDelivery) private readonly deliveries: Repository<CampaignDelivery>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly communications: CommunicationsService,
  ) {}
  list() { return this.campaigns.find({ order: { createdAt: 'DESC' } }); }
  create(input: { name: string; audienceType: CampaignAudienceType; body: string; audienceUserIds?: string[]; segmentId?: string; scheduledAt?: string }) {
    if (input.audienceType === CampaignAudienceType.INDIVIDUAL && (!input.audienceUserIds || input.audienceUserIds.length === 0)) throw new BadRequestException('Individual campaigns need recipients');
    if (input.audienceUserIds && input.audienceUserIds.length > 50000) throw new BadRequestException('Campaign audience exceeds the limit');
    return this.campaigns.save(this.campaigns.create({ ...input, audienceUserIds: input.audienceUserIds ?? null, segmentId: input.segmentId ?? null, scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null, confirmedAt: null, frozenProviderKey: null, status: CampaignStatus.DRAFT }));
  }
  async confirm(id: string) {
    const campaign = await this.campaigns.findOneBy({ id });
    if (!campaign) throw new NotFoundException('Campaign was not found');
    if (campaign.status !== CampaignStatus.DRAFT) throw new BadRequestException('Only draft campaigns can be confirmed');
    campaign.status = CampaignStatus.SCHEDULED;
    campaign.confirmedAt = new Date();
    campaign.frozenProviderKey = 'deterministic';
    return this.campaigns.save(campaign);
  }

  async dispatch(id: string) {
    const campaign = await this.campaigns.findOneBy({ id });
    if (!campaign) throw new NotFoundException('Campaign was not found');
    if (campaign.status !== CampaignStatus.SCHEDULED) throw new BadRequestException('Campaign is not ready for dispatch');
    const users = campaign.audienceType === CampaignAudienceType.INDIVIDUAL
      ? await this.users.find({ where: { id: In(campaign.audienceUserIds ?? []), status: UserStatus.ACTIVE } })
      : await this.users.find({ where: { status: UserStatus.ACTIVE } });
    campaign.status = CampaignStatus.SENDING;
    await this.campaigns.save(campaign);
    let accepted = 0;
    for (const user of users.slice(0, 50000)) {
      if (!user.mobile || !user.mobileVerifiedAt) continue;
      const history = await this.communications.queueCampaignMessage(user.id, user.mobile, campaign.body);
      await this.deliveries.save(this.deliveries.create({ campaignId: id, userId: user.id, messageIntentId: history.id, status: 'queued' }));
      accepted += 1;
    }
    campaign.status = CampaignStatus.COMPLETED;
    await this.campaigns.save(campaign);
    return { campaignId: id, accepted, skipped: users.length - accepted, status: campaign.status };
  }

  async cancel(id: string) {
    const campaign = await this.campaigns.findOneBy({ id });
    if (!campaign) throw new NotFoundException('Campaign was not found');
    if (campaign.status === CampaignStatus.COMPLETED) throw new BadRequestException('Completed campaigns cannot be cancelled');
    campaign.status = CampaignStatus.CANCELLED;
    return this.campaigns.save(campaign);
  }

  async deliveriesFor(id: string) {
    const campaign = await this.campaigns.findOneBy({ id });
    if (!campaign) throw new NotFoundException('Campaign was not found');
    return this.deliveries.find({ where: { campaignId: id }, order: { createdAt: 'ASC' } });
  }

  async exportCsv(id: string): Promise<string> {
    const rows = await this.deliveriesFor(id);
    return ['user_id,status,message_intent_id', ...rows.map((row) => `${row.userId},${row.status},${row.messageIntentId ?? ''}`)].join('\n');
  }
}
