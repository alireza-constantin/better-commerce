import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'shipping_methods' })
@Index('IDX_shipping_methods_zone_active', ['zoneId', 'active'])
export class ShippingMethod {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'zone_id', type: 'uuid' }) zoneId!: string;
  @Column({ type: 'varchar', length: 160 }) title!: string;
  @Column({ type: 'integer', default: 0 }) position!: number;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
