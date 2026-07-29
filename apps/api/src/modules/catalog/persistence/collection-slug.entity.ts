import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CatalogCollection } from './collection.entity';

@Entity({ name: 'catalog_collection_slugs' })
@Index('UQ_catalog_collection_slugs_slug', ['slug'], { unique: true })
@Index('UQ_catalog_collection_slugs_canonical', ['collectionId'], {
  unique: true,
  where: 'is_canonical',
})
export class CatalogCollectionSlug {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId: string;

  @Column({ type: 'varchar', length: 160 })
  slug: string;

  @Column({ name: 'is_canonical', type: 'boolean', default: false })
  isCanonical: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => CatalogCollection, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'collection_id' })
  private readonly collection?: CatalogCollection;
}
