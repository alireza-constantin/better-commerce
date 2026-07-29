import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogGroupingStatus } from './grouping-status';

@Entity({ name: 'catalog_categories' })
@Check('CHK_catalog_categories_version_positive', 'version > 0')
@Check('CHK_catalog_categories_position_nonnegative', 'position >= 0')
@Index('UQ_catalog_categories_parent_position', ['parentId', 'position'], {
  unique: true,
  where: 'parent_id IS NOT NULL',
})
@Index('UQ_catalog_categories_root_position', ['position'], {
  unique: true,
  where: 'parent_id IS NULL',
})
@Index('IX_catalog_categories_updated_id', ['updatedAt', 'id'])
export class CatalogCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @Column({
    type: 'enum',
    enum: CatalogGroupingStatus,
    enumName: 'catalog_grouping_status',
    default: CatalogGroupingStatus.ACTIVE,
  })
  status: CatalogGroupingStatus;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 160 })
  slug: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'integer' })
  position: number;

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => CatalogCategory, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_id' })
  private readonly parent?: CatalogCategory | null;
}
