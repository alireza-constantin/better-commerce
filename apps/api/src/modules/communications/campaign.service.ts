import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CampaignAudienceType, CampaignStatus, CommunicationCampaign } from './campaign.entity';

@Injectable()
export class CampaignService {
  constructor(@InjectRepository(CommunicationCampaign) private readonly campaigns: Repository<CommunicationCampaign>) {}
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
}
