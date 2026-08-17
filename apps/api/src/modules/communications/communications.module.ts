import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageDeliveryAttempt } from './message-delivery-attempt.entity';
import { MessageIntent } from './message-intent.entity';
import { User } from '../identity/persistence/user.entity';
import { CommunicationTemplate } from './communication-template.entity';
import { TemplateService } from './template.service';
import { TemplateAdminController } from './template-admin.controller';
import { CommunicationCampaign } from './campaign.entity';
import { CampaignService } from './campaign.service';
import { CampaignAdminController } from './campaign-admin.controller';
import { MessageProviderRoute } from './message-provider-route.entity';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageIntent,
      MessageDeliveryAttempt,
      MessageProviderRoute,
      User,
      CommunicationTemplate,
      CommunicationCampaign,
    ]),
  ],
  controllers: [CommunicationsController, TemplateAdminController, CampaignAdminController],
  providers: [CommunicationsService, TemplateService, CampaignService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
