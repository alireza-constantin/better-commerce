import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CatalogApplicationService } from '../src/modules/catalog/application/catalog-application.service';
import { CatalogNavigationService } from '../src/modules/catalog/application/catalog-navigation.service';
import { CatalogProductCategory } from '../src/modules/catalog/persistence/product-category.entity';
import { createFullApplication } from './full-app.helper';

describe('Catalog navigation behavior', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let catalog: CatalogApplicationService;
  let navigation: CatalogNavigationService;

  const audit = { actorUserId: null, requestId: 'catalog-navigation-test' };

  beforeAll(async () => {
    app = await createFullApplication();
    dataSource = app.get(DataSource);
    catalog = app.get(CatalogApplicationService);
    navigation = app.get(CatalogNavigationService);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE commerce_audit_events, catalog_collection_products, catalog_collection_slugs, catalog_collections, catalog_product_categories, catalog_category_slugs, catalog_categories, catalog_variant_selections, catalog_option_values, catalog_product_options, catalog_variants, catalog_product_slugs, catalog_products CASCADE',
    );
  });

  afterAll(async () => app.close());

  it('moves one Category atomically and rejects cycles and stale versions', async () => {
    const first = await navigation.createCategory(
      { title: 'First', slug: 'first', position: 0 },
      audit,
    );
    const second = await navigation.createCategory(
      { title: 'Second', slug: 'second', position: 1 },
      audit,
    );
    const child = await navigation.createCategory(
      {
        title: 'Child',
        slug: 'child',
        parentId: first.id,
        position: 0,
      },
      audit,
    );

    await expect(
      navigation.moveCategory(
        first.id,
        {
          expectedVersion: first.version,
          parentId: child.id,
          position: 0,
        },
        audit,
      ),
    ).rejects.toMatchObject({ code: 'catalog.category_hierarchy_conflict' });

    const moved = await navigation.moveCategory(
      second.id,
      { expectedVersion: second.version, position: 0 },
      audit,
    );
    expect(moved).toMatchObject({ position: 0, version: 2 });
    await expect(
      navigation.moveCategory(
        second.id,
        { expectedVersion: second.version, position: 1 },
        audit,
      ),
    ).rejects.toMatchObject({
      code: 'catalog.version_conflict',
      currentVersion: 2,
    });
    await expect(navigation.listPublicCategories()).resolves.toEqual([
      expect.objectContaining({ id: second.id, position: 0 }),
      expect.objectContaining({ id: first.id, position: 1 }),
      expect.objectContaining({ id: child.id, parentId: first.id }),
    ]);
  });

  it('reserves Category aliases and hides archived definitions without deleting membership', async () => {
    const category = await navigation.createCategory(
      { title: 'Shoes', slug: 'shoes', position: 0 },
      audit,
    );
    const edited = await navigation.editCategory(
      category.id,
      {
        expectedVersion: category.version,
        title: 'Footwear',
        slug: 'footwear',
      },
      audit,
    );
    await expect(
      navigation.resolvePublicCategory('shoes'),
    ).resolves.toMatchObject({
      canonicalSlug: 'footwear',
      requestedSlugIsCanonical: false,
    });
    const product = await catalog.createProduct({
      title: 'Boot',
      slug: 'boot',
      fulfillmentClassification: 'physical',
    });
    const membership = await navigation.replaceProductCategories(
      product.productId,
      { expectedVersion: 1, ids: [category.id] },
      audit,
    );
    expect(membership.version).toBe(2);

    await navigation.archiveCategory(category.id, edited.version, audit);
    await expect(
      navigation.resolvePublicCategory('footwear'),
    ).rejects.toMatchObject({ code: 'catalog.category_not_found' });
    await expect(
      dataSource.getRepository(CatalogProductCategory).countBy({
        productId: product.productId,
      }),
    ).resolves.toBe(1);
    await expect(
      navigation.createCategory(
        { title: 'Other', slug: 'shoes', position: 1 },
        audit,
      ),
    ).rejects.toMatchObject({ code: 'catalog.category_slug_conflict' });
  });

  it('keeps ordered Collection membership, aliases, and visibility transactional', async () => {
    const first = await catalog.createProduct({
      title: 'First Product',
      slug: 'first-product',
      fulfillmentClassification: 'physical',
    });
    const second = await catalog.createProduct({
      title: 'Second Product',
      slug: 'second-product',
      fulfillmentClassification: 'physical',
    });
    const collection = await navigation.createCollection(
      { title: 'Featured', slug: 'featured' },
      audit,
    );
    const populated = await navigation.replaceCollectionProducts(
      collection.id,
      collection.version,
      [
        { productId: second.productId, position: 0 },
        { productId: first.productId, position: 1 },
      ],
      audit,
    );
    expect(populated.version).toBe(2);
    await expect(
      navigation.replaceCollectionProducts(
        collection.id,
        collection.version,
        [],
        audit,
      ),
    ).rejects.toMatchObject({ code: 'catalog.version_conflict' });

    const edited = await navigation.editCollection(
      collection.id,
      {
        expectedVersion: populated.version,
        title: 'Highlights',
        slug: 'highlights',
      },
      audit,
    );
    await expect(
      navigation.resolvePublicCollection('featured'),
    ).resolves.toMatchObject({
      canonicalSlug: 'highlights',
      requestedSlugIsCanonical: false,
    });
    await navigation.archiveCollection(collection.id, edited.version, audit);
    await expect(
      navigation.resolvePublicCollection('highlights'),
    ).rejects.toMatchObject({ code: 'catalog.collection_not_found' });
  });
});
