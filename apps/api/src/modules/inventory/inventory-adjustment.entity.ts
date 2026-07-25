import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'inventory_adjustments' })
@Index('IDX_inventory_adjustments_item_created', ['inventoryItemId', 'createdAt'])
export class InventoryAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inventory_item_id', type: 'uuid' })
  inventoryItemId!: string;

  @Column({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @Column({ type: 'integer' })
  delta!: number;

  @Column({ name: 'resulting_on_hand', type: 'integer' })
  resultingOnHand!: number;

  @Column({ name: 'reason_code', type: 'varchar', length: 40 })
  reasonCode!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
