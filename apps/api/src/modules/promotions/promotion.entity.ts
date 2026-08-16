import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { PromotionStatus } from './promotions.types';

@Entity({ name: 'promotions' })
@Index('UQ_promotions_code', ['code'], {
  unique: true,
  where: 'code IS NOT NULL',
})
@Check('CHK_promotions_limits', 'total_limit IS NULL OR total_limit > 0')
@Check(
  'CHK_promotions_customer_limit',
  'per_customer_limit IS NULL OR per_customer_limit > 0',
)
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 24 })
  status!: PromotionStatus;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({
    name: 'current_definition_version_id',
    type: 'uuid',
    nullable: true,
  })
  currentDefinitionVersionId!: string | null;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  code!: string | null;

  @Column({ name: 'total_limit', type: 'integer', nullable: true })
  totalLimit!: number | null;

  @Column({ name: 'per_customer_limit', type: 'integer', nullable: true })
  perCustomerLimit!: number | null;

  @Column({ name: 'redemption_count', type: 'integer', default: 0 })
  redemptionCount!: number;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
