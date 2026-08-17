import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum MobileOtpChallengeStatus {
  PENDING = 'pending',
  CONSUMED = 'consumed',
  EXPIRED = 'expired',
  LOCKED = 'locked',
}

@Entity({ name: 'mobile_otp_challenges' })
@Index('IDX_mobile_otp_challenges_mobile_created_at', ['mobileNormalized', 'createdAt'])
export class MobileOtpChallenge {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'mobile_normalized', type: 'varchar', length: 16 })
  mobileNormalized!: string;

  /** Store only a one-way digest; the six digit code is never persisted. */
  @Column({ name: 'code_digest', type: 'varchar', length: 128 })
  codeDigest!: string;

  @Column({ name: 'status', type: 'varchar', length: 16, default: MobileOtpChallengeStatus.PENDING })
  status!: MobileOtpChallengeStatus;

  @Column({ name: 'attempt_count', type: 'integer', default: 0 })
  attemptCount!: number;

  @Column({ name: 'max_attempts', type: 'integer', default: 5 })
  maxAttempts!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
