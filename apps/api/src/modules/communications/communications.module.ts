import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageDeliveryAttempt } from './message-delivery-attempt.entity';
import { MessageIntent } from './message-intent.entity';
import { User } from '../identity/persistence/user.entity';
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
    ]),
  ],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
