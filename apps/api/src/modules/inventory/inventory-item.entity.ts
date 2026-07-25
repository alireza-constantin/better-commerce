import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum InventoryTrackingMode {
  TRACKED = 'tracked',
  UNTRACKED = 'untracked',
}

@Entity({ name: 'inventory_items' })
@Index('UQ_inventory_items_variant_id', ['variantId'], { unique: true })
@Check('CHK_inventory_items_on_hand', 'on_hand >= 0')
@Check('CHK_inventory_items_reserved', 'reserved_quantity >= 0')
@Check('CHK_inventory_items_available', 'reserved_quantity <= on_hand')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ name: 'tracking_mode', type: 'varchar', length: 16 })
  trackingMode!: InventoryTrackingMode;

  @Column({ name: 'on_hand', type: 'integer', default: 0 })
  onHand!: number;

  @Column({ name: 'reserved_quantity', type: 'integer', default: 0 })
  reservedQuantity!: number;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
