import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommerceAuditModule } from '../commerce-audit';
import { Promotion } from './promotion.entity';
import { PromotionDefinitionVersion } from './promotion-definition-version.entity';
import { PromotionRedemption } from './promotion-redemption.entity';
import { PROMOTIONS_MODULE_CONTRACT } from './promotions.contract';
import { PromotionsService } from './promotions.service';
import { PromotionsAdminController } from './promotions.controller';

@Module({
  imports: [
    CommerceAuditModule,
    TypeOrmModule.forFeature([
      Promotion,
      PromotionDefinitionVersion,
      PromotionRedemption,
    ]),
  ],
  providers: [
    PromotionsService,
    { provide: PROMOTIONS_MODULE_CONTRACT, useExisting: PromotionsService },
  ],
  controllers: [PromotionsAdminController],
  exports: [PROMOTIONS_MODULE_CONTRACT, PromotionsService],
})
export class PromotionsModule {}
