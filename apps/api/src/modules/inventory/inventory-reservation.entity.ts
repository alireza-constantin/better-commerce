import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum InventoryReservationStatus {
  ACTIVE = 'active',
  RELEASED = 'released',
  COMMITTED = 'committed',
  EXPIRED = 'expired',
}

@Entity({ name: 'inventory_reservations' })
@Index('IDX_inventory_reservations_item_active', ['inventoryItemId', 'status', 'expiresAt'])
@Index('UQ_inventory_reservations_correlation_variant', ['correlationKey', 'variantId'], { unique: true })
export class InventoryReservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({ name: 'correlation_key', type: 'varchar', length: 160 })
  correlationKey!: string;

  @Column({ type: 'varchar', length: 16 })
  status!: InventoryReservationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'terminal_at', type: 'timestamptz', nullable: true })
  terminalAt!: Date | null;

  @Column({ name: 'terminal_reason', type: 'varchar', length: 80, nullable: true })
  terminalReason!: string | null;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
