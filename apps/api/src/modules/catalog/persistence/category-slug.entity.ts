import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CatalogCategory } from './category.entity';

@Entity({ name: 'catalog_category_slugs' })
@Index('UQ_catalog_category_slugs_slug', ['slug'], { unique: true })
@Index('UQ_catalog_category_slugs_canonical', ['categoryId'], {
  unique: true,
  where: 'is_canonical',
})
export class CatalogCategorySlug {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({ type: 'varchar', length: 160 })
  slug: string;

  @Column({ name: 'is_canonical', type: 'boolean', default: false })
  isCanonical: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => CatalogCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  private readonly category?: CatalogCategory;
}
