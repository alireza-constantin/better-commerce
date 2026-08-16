import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  PromotionEligibility,
  PromotionRuleKind,
  PromotionTargetKind,
} from './promotions.types';

@Entity({ name: 'promotion_definition_versions' })
@Index('UQ_promotion_definition_versions_number', ['promotionId', 'version'], {
  unique: true,
})
export class PromotionDefinitionVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'promotion_id', type: 'uuid' })
  promotionId!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 2_000, nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 16 })
  eligibility!: PromotionEligibility;

  @Column({ type: 'varchar', length: 64, nullable: true })
  code!: string | null;

  @Column({ name: 'rule_kind', type: 'varchar', length: 16 })
  ruleKind!: PromotionRuleKind;

  @Column({ name: 'percentage_basis_points', type: 'integer', nullable: true })
  percentageBasisPoints!: number | null;

  @Column({ name: 'fixed_minor_amount', type: 'bigint', nullable: true })
  fixedMinorAmount!: string | null;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'target_kind', type: 'varchar', length: 16 })
  targetKind!: PromotionTargetKind;

  @Column({ name: 'target_ids', type: 'jsonb' })
  targetIds!: readonly string[];

  @Column({ type: 'integer' })
  priority!: number;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt!: Date;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt!: Date | null;

  @Column({ name: 'total_limit', type: 'integer', nullable: true })
  totalLimit!: number | null;

  @Column({ name: 'per_customer_limit', type: 'integer', nullable: true })
  perCustomerLimit!: number | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
