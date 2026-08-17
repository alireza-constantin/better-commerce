import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerProfile } from './customer-profile.entity';
import { User } from '../identity/persistence/user.entity';
import { CustomerDirectoryService } from './customer-directory.service';
import { CustomersAdminController } from './customers-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerProfile, User])],
  controllers: [CustomersAdminController],
  providers: [CustomerDirectoryService],
  exports: [TypeOrmModule],
})
export class CustomersModule {}
