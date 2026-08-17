import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CustomerProfileStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Entity({ name: 'customer_profiles' })
@Index('UQ_customer_profiles_user_id', ['userId'], { unique: true })
export class CustomerProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName!: string;

  @Column({ type: 'varchar', length: 16, default: CustomerProfileStatus.PENDING })
  status!: CustomerProfileStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
