import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'catalog_product_media' })
@Index('UQ_catalog_product_media_position', ['productId', 'position'], {
  unique: true,
})
@Index('UQ_catalog_product_media_object_key', ['objectKey'], { unique: true })
@Check('CHK_catalog_product_media_position', 'position >= 0')
@Check('CHK_catalog_product_media_dimensions', 'width > 0 AND height > 0')
@Check('CHK_catalog_product_media_byte_size', 'byte_size > 0')
export class CatalogProductMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'object_key', type: 'varchar', length: 500 })
  objectKey: string;

  @Column({ type: 'varchar', length: 2_000 })
  url: string;

  @Column({ name: 'alt_text', type: 'varchar', length: 300, default: '' })
  altText: string;

  @Column({ type: 'integer' })
  position: number;

  @Column({ name: 'media_type', type: 'varchar', length: 100 })
  mediaType: string;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @Column({ name: 'byte_size', type: 'integer' })
  byteSize: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
