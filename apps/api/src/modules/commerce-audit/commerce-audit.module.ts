import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommerceAuditController } from './commerce-audit.controller';
import { COMMERCE_AUDIT_CONTRACT } from './commerce-audit.contract';
import { CommerceAuditEvent } from './persistence/commerce-audit-event.entity';
import { CommerceAuditService } from './persistence/commerce-audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommerceAuditEvent])],
  controllers: [CommerceAuditController],
  providers: [
    CommerceAuditService,
    { provide: COMMERCE_AUDIT_CONTRACT, useExisting: CommerceAuditService },
  ],
  exports: [COMMERCE_AUDIT_CONTRACT],
})
export class CommerceAuditModule {}
