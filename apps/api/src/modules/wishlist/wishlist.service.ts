import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatalogVariant } from '../catalog/persistence/variant.entity';
import { WishlistItem } from './wishlist-item.entity';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly items: Repository<WishlistItem>,
    @InjectRepository(CatalogVariant)
    private readonly variants: Repository<CatalogVariant>,
  ) {}

  async list(userId: string) {
    const items = await this.items.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return { data: items, count: items.length };
  }

  async add(userId: string, variantId: string) {
    const variant = await this.variants.findOneBy({ id: variantId });
    if (!variant) throw new NotFoundException('Variant was not found');
    const existing = await this.items.findOneBy({ userId, variantId });
    if (existing) return existing;
    try {
      return await this.items.save(this.items.create({ userId, variantId }));
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        return this.items.findOneByOrFail({ userId, variantId });
      }
      throw error;
    }
  }

  async remove(userId: string, variantId: string): Promise<void> {
    await this.items.delete({ userId, variantId });
  }

  private isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
  }
}
