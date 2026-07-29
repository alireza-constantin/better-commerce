import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CartStatus {
  ACTIVE = 'active',
  CHECKED_OUT = 'checked_out',
  MERGED = 'merged',
  EXPIRED = 'expired',
}

@Entity({ name: 'carts' })
@Index('UQ_carts_active_customer', ['userId'], {
  unique: true,
  where: `"status" = 'active' AND "user_id" IS NOT NULL`,
})
@Index(['anonymousTokenDigest'], { unique: true })
@Check(
  'CHK_carts_owner',
  `"status" <> 'active' OR (("user_id" IS NOT NULL AND "anonymous_token_digest" IS NULL) OR ("user_id" IS NULL AND "anonymous_token_digest" IS NOT NULL))`,
)
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({
    name: 'anonymous_token_digest',
    type: 'char',
    length: 64,
    nullable: true,
  })
  anonymousTokenDigest!: string | null;

  @Column({ type: 'varchar', length: 24 })
  status!: CartStatus;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'terminal_at', type: 'timestamptz', nullable: true })
  terminalAt!: Date | null;

  @Column({ name: 'successor_cart_id', type: 'uuid', nullable: true })
  successorCartId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
