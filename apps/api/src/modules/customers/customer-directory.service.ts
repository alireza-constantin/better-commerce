import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User, UserStatus } from '../identity/persistence/user.entity';
import { CustomerProfile } from './customer-profile.entity';

export interface CustomerDirectoryQuery {
  readonly q?: string;
  readonly status?: UserStatus;
  readonly limit: number;
}

export interface CustomerDirectoryItem {
  readonly id: string;
  readonly displayName: string;
  readonly email: string | null;
  readonly mobile: string | null;
  readonly status: UserStatus;
  readonly registeredAt: Date;
}

@Injectable()
export class CustomerDirectoryService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(CustomerProfile)
    private readonly profiles: Repository<CustomerProfile>,
  ) {}

  async list(query: CustomerDirectoryQuery) {
    const builder = this.users
      .createQueryBuilder('user')
      .leftJoin(CustomerProfile, 'profile', 'profile.user_id = user.id')
      .select([
        'user.id AS id',
        'user.email AS email',
        'user.mobile AS mobile',
        'user.status AS status',
        'user.created_at AS "registeredAt"',
        "COALESCE(profile.display_name, user.email, user.mobile, 'Customer') AS \"displayName\"",
      ])
      .orderBy('user.created_at', 'DESC')
      .limit(Math.min(Math.max(query.limit, 1), 100));
    if (query.status) builder.andWhere('user.status = :status', { status: query.status });
    if (query.q?.trim()) {
      const q = query.q.trim();
      builder.andWhere(
        new Brackets((where) =>
          where
            .where('user.email_normalized = :exact', { exact: q.normalize('NFKC').toLowerCase() })
            .orWhere('user.mobile_normalized = :mobile', { mobile: q.replace(/\D/g, '') })
            .orWhere('profile.display_name ILIKE :prefix', { prefix: `${q}%` }),
        ),
      );
    }
    const rows = await builder.getRawMany<CustomerDirectoryItem>();
    return {
      data: rows.map((row) => ({
        ...row,
        mobile: row.mobile ? this.maskMobile(row.mobile) : null,
      })),
      nextCursor: null,
    };
  }

  async get(id: string): Promise<CustomerDirectoryItem> {
    const row = await this.users
      .createQueryBuilder('user')
      .leftJoin(CustomerProfile, 'profile', 'profile.user_id = user.id')
      .select([
        'user.id AS id',
        'user.email AS email',
        'user.mobile AS mobile',
        'user.status AS status',
        'user.created_at AS "registeredAt"',
        "COALESCE(profile.display_name, user.email, user.mobile, 'Customer') AS \"displayName\"",
      ])
      .where('user.id = :id', { id })
      .getRawOne<CustomerDirectoryItem>();
    if (!row) throw new NotFoundException('Customer was not found');
    return { ...row, mobile: row.mobile ? this.maskMobile(row.mobile) : null };
  }

  private maskMobile(mobile: string): string {
    if (mobile.length <= 6) return '••••••';
    return `${mobile.slice(0, 4)}******${mobile.slice(-2)}`;
  }
}
