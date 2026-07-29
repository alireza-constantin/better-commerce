import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CatalogCategory } from './category.entity';
import { CatalogProduct } from './product.entity';

@Entity({ name: 'catalog_product_categories' })
@Index('IX_catalog_product_categories_category', ['categoryId', 'productId'])
export class CatalogProductCategory {
  @PrimaryColumn({ name: 'product_id', type: 'uuid' })
  productId: string;

  @PrimaryColumn({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => CatalogProduct, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  private readonly product?: CatalogProduct;

  @ManyToOne(() => CatalogCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  private readonly category?: CatalogCategory;
}
