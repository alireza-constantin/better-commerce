import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogVariant } from '../catalog/persistence/variant.entity';
import { WishlistController } from './wishlist.controller';
import { WishlistItem } from './wishlist-item.entity';
import { WishlistService } from './wishlist.service';
import { WishlistAlert } from './wishlist-alert.entity';
import { WishlistAlertService } from './wishlist-alert.service';
import { WishlistAlertAdminController } from './wishlist-alert-admin.controller';
import { User } from '../identity/persistence/user.entity';
import { CommunicationsModule } from '../communications/communications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WishlistItem, WishlistAlert, CatalogVariant, User]),
    CommunicationsModule,
  ],
  controllers: [WishlistController, WishlistAlertAdminController],
  providers: [WishlistService, WishlistAlertService],
  exports: [WishlistService],
})
export class WishlistModule {}
