import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualPaymentHistory } from './manual-payment-history.entity';
import { ManualPayment } from './manual-payment.entity';
import { PAYMENTS_MODULE_CONTRACT } from './payments.contract';
import { PaymentsService } from './payments.service';

@Module({
  imports: [TypeOrmModule.forFeature([ManualPayment, ManualPaymentHistory])],
  providers: [
    PaymentsService,
    { provide: PAYMENTS_MODULE_CONTRACT, useExisting: PaymentsService },
  ],
  exports: [PAYMENTS_MODULE_CONTRACT],
})
export class PaymentsModule {}
