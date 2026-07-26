import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualPaymentHistory } from './manual-payment-history.entity';
import { ManualPayment } from './manual-payment.entity';
import { PAYMENTS_MODULE_CONTRACT } from './payments.contract';
import { PaymentsService } from './persistence/payments.service';
import { CommerceAuditModule } from '../commerce-audit';

@Module({
  imports: [
    TypeOrmModule.forFeature([ManualPayment, ManualPaymentHistory]),
    CommerceAuditModule,
  ],
  providers: [
    PaymentsService,
    { provide: PAYMENTS_MODULE_CONTRACT, useExisting: PaymentsService },
  ],
  exports: [PAYMENTS_MODULE_CONTRACT],
})
export class PaymentsModule {}
