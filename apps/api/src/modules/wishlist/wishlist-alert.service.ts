import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunicationsService } from '../communications/communications.service';
import { User, UserStatus } from '../identity/persistence/user.entity';
import { WishlistAlert, WishlistAlertStatus } from './wishlist-alert.entity';
import { WishlistItem } from './wishlist-item.entity';

@Injectable()
export class WishlistAlertService {
  constructor(
    @InjectRepository(WishlistAlert)
    private readonly alerts: Repository<WishlistAlert>,
    @InjectRepository(WishlistItem)
    private readonly items: Repository<WishlistItem>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly communications: CommunicationsService,
  ) {}

  async subscribe(userId: string, variantId: string, episodeKey = 'current') {
    const item = await this.items.findOneBy({ userId, variantId });
    if (!item) throw new NotFoundException('Add the variant to your wishlist first');
    const user = await this.users.findOneBy({ id: userId });
    if (!user || user.status !== UserStatus.ACTIVE || !user.mobile || !user.mobileVerifiedAt) {
      throw new ConflictException('A verified mobile number is required for alerts');
    }
    const existing = await this.alerts.findOneBy({ userId, variantId, episodeKey });
    if (existing) return existing;
    return this.alerts.save(
      this.alerts.create({
        userId,
        variantId,
        episodeKey,
        status: WishlistAlertStatus.PENDING,
        sentAt: null,
      }),
    );
  }

  list(userId: string) {
    return this.alerts.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async evaluateVariant(
    variantId: string,
    episodeKey: string,
    available: boolean,
  ): Promise<number> {
    if (!available) return 0;
    const pending = await this.alerts.find({
      where: { variantId, episodeKey, status: WishlistAlertStatus.PENDING },
    });
    let sent = 0;
    for (const alert of pending) {
      const user = await this.users.findOneBy({ id: alert.userId });
      if (!user?.mobile || !user.mobileVerifiedAt) continue;
      await this.communications.queueWishlistAlert(
        user.mobile,
        'The variant you saved is available again.',
      );
      alert.status = WishlistAlertStatus.SENT;
      alert.sentAt = new Date();
      await this.alerts.save(alert);
      sent += 1;
    }
    return sent;
  }
}
