import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmailVerificationToken } from './email-verification-token.entity';
import { PasswordCredential } from './password-credential.entity';

export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Entity({ name: 'users' })
@Index('UQ_users_email_normalized', ['emailNormalized'], { unique: true })
@Index('UQ_users_mobile_normalized', ['mobileNormalized'], { unique: true })
@Check('CHK_users_auth_version_non_negative', '"auth_version" >= 0')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The address as entered by the user, retained for display and delivery. */
  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string | null;

  /**
   * The canonical lookup key. Application services must populate this with the
   * shared email-normalization function before persisting a user.
   */
  @Column({ name: 'email_normalized', type: 'varchar', length: 320, nullable: true })
  emailNormalized: string | null;

  /** Canonical Iranian mobile digits without the leading plus sign. */
  @Column({ name: 'mobile', type: 'varchar', length: 16, nullable: true })
  mobile: string | null;

  @Column({ name: 'mobile_normalized', type: 'varchar', length: 16, nullable: true })
  mobileNormalized: string | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  /** Incrementing this invalidates every session issued for the user. */
  @Column({ name: 'auth_version', type: 'integer', default: 0 })
  authVersion: number;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'mobile_verified_at', type: 'timestamptz', nullable: true })
  mobileVerifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToOne(() => PasswordCredential, (credential) => credential.user)
  passwordCredential?: PasswordCredential;

  @OneToMany(() => EmailVerificationToken, (token) => token.user)
  emailVerificationTokens?: EmailVerificationToken[];
}
