import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CatalogCollection } from './collection.entity';
import { CatalogProduct } from './product.entity';

@Entity({ name: 'catalog_collection_products' })
@Check('CHK_catalog_collection_products_position', 'position >= 0')
@Index(
  'UQ_catalog_collection_products_membership',
  ['collectionId', 'productId'],
  { unique: true },
)
@Index(
  'UQ_catalog_collection_products_position',
  ['collectionId', 'position'],
  { unique: true },
)
export class CatalogCollectionProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'collection_id', type: 'uuid' })
  collectionId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ type: 'integer' })
  position: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => CatalogCollection, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'collection_id' })
  private readonly collection?: CatalogCollection;

  @ManyToOne(() => CatalogProduct, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  private readonly product?: CatalogProduct;
}
