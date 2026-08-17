import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerProfile } from './customer-profile.entity';
import { User } from '../identity/persistence/user.entity';
import { CustomerDirectoryService } from './customer-directory.service';
import { CustomersAdminController } from './customers-admin.controller';
import { CustomerSegment } from './customer-segment.entity';
import { SegmentService } from './segment.service';
import { SegmentAdminController } from './segment-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerProfile, User, CustomerSegment])],
  controllers: [SegmentAdminController, CustomersAdminController],
  providers: [CustomerDirectoryService, SegmentService],
})
export class CustomersModule {}
