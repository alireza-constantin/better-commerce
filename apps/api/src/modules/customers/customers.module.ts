import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerProfile } from './customer-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerProfile])],
  exports: [TypeOrmModule],
})
export class CustomersModule {}
