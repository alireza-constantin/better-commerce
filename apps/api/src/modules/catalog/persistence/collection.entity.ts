import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogGroupingStatus } from './grouping-status';

@Entity({ name: 'catalog_collections' })
@Check('CHK_catalog_collections_version_positive', 'version > 0')
@Index('IX_catalog_collections_updated_id', ['updatedAt', 'id'])
export class CatalogCollection {
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

  @Column({ name: 'archived_at', type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
