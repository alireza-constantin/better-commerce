import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promotion } from './promotion.entity';
import { PromotionDefinitionVersion } from './promotion-definition-version.entity';
import { PromotionRedemption } from './promotion-redemption.entity';
import { PROMOTIONS_MODULE_CONTRACT } from './promotions.contract';
import { PromotionsService } from './promotions.service';

@Module({
  imports: [
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
  exports: [PROMOTIONS_MODULE_CONTRACT, PromotionsService],
})
export class PromotionsModule {}
