import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'catalog_variant_media' })
@Index('UQ_catalog_variant_media_position', ['variantId', 'position'], {
  unique: true,
})
export class CatalogVariantMedia {
  @PrimaryColumn({ name: 'variant_id', type: 'uuid' })
  variantId!: string;

  @PrimaryColumn({ name: 'media_id', type: 'uuid' })
  mediaId!: string;

  @Column({ type: 'integer' })
  position!: number;
}
