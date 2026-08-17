import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '../authorization';
import { MessageDeliveryAttempt } from './message-delivery-attempt.entity';
import { MessageIntent } from './message-intent.entity';
import { MessageProviderRoute } from './message-provider-route.entity';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageIntent,
      MessageDeliveryAttempt,
      MessageProviderRoute,
    ]),
    AuthorizationModule,
  ],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
  exports: [CommunicationsService],
})
export class CommunicationsModule {}
