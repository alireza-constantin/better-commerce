import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { In, QueryFailedError, type EntityManager } from 'typeorm';
import type { DatabaseTransactionContext } from '../../../platform/database';
import {
  COMMERCE_AUDIT_CONTRACT,
  CommerceAuditAction,
  type CommerceAuditContract,
  type CommerceAuditMetadata,
} from '../../commerce-audit/commerce-audit.contract';
import { CATALOG_RESERVED_ROUTES } from '../catalog.constants';
import {
  assertCategoryPlacement,
  assertContiguousPositions,
  CATALOG_NAVIGATION_LIMITS,
  CatalogNavigationRuleError,
  normalizeSlug,
  optionalText,
  requiredText,
} from '../domain';
import {
  CatalogCategory,
  CatalogCategorySlug,
  CatalogCollection,
  CatalogCollectionProduct,
  CatalogCollectionSlug,
  CatalogGroupingStatus,
  CatalogProduct,
  CatalogProductCategory,
} from '../persistence';
import { CatalogPersistenceService } from '../persistence/catalog-persistence.service';
import { CatalogApplicationError } from './catalog-application.error';

export interface CatalogAuditContext {
  readonly actorUserId: string | null;
  readonly requestId?: string | null;
}

export interface GroupingTextCommand {
  readonly expectedVersion?: number;
  readonly title: string;
  readonly summary?: string | null;
  readonly description?: string | null;
  readonly slug: string;
}

export interface CreateCategoryCommand extends GroupingTextCommand {
  readonly parentId?: string | null;
  readonly position: number;
}

export interface MoveCategoryCommand {
  readonly expectedVersion: number;
  readonly parentId?: string | null;
  readonly position: number;
}

export interface ReplaceMembershipCommand {
  readonly expectedVersion: number;
  readonly ids: readonly string[];
}

export interface OrderedProductMembership {
  readonly productId: string;
  readonly position: number;
}

export interface CategoryProjection {
  readonly id: string;
  readonly version: number;
  readonly status: CatalogGroupingStatus;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly slug: string;
  readonly parentId: string | null;
  readonly position: number;
  readonly archivedAt: Date | null;
}

export interface CollectionProjection {
  readonly id: string;
  readonly version: number;
  readonly status: CatalogGroupingStatus;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly slug: string;
  readonly archivedAt: Date | null;
}

export interface PublicCategoryProjection {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly slug: string;
  readonly parentId: string | null;
  readonly position: number;
}

export interface PublicCollectionProjection {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly slug: string;
}

@Injectable()
export class CatalogNavigationService {
  constructor(
    private readonly persistence: CatalogPersistenceService,
    @Inject(COMMERCE_AUDIT_CONTRACT)
    private readonly audit: CommerceAuditContract,
    @Inject(CATALOG_RESERVED_ROUTES)
    private readonly reservedRoutes: readonly string[],
  ) {}

  async createCategory(
    input: CreateCategoryCommand,
    audit: CatalogAuditContext,
  ): Promise<CategoryProjection> {
    const text = this.categoryText(input);
    const parentId = input.parentId ?? null;
    this.position(input.position);
    try {
      return await this.persistence.withTransaction(
        async (manager, transaction) => {
          const repository = manager.getRepository(CatalogCategory);
          if (
            (await repository.count()) >= CATALOG_NAVIGATION_LIMITS.categories
          )
            throw this.validation('Category limit was reached');
          const categories = await this.lockCategories(manager);
          if (
            parentId &&
            categories.find((row) => row.id === parentId)?.status !==
              CatalogGroupingStatus.ACTIVE
          )
            throw this.hierarchy('Parent Category must be active');
          const siblings = this.siblings(categories, parentId);
          if (input.position > siblings.length)
            throw this.hierarchy('Category position is outside its siblings');
          const id = randomUUID();
          assertCategoryPlacement(categories, id, parentId);
          await this.parkSiblings(
            manager,
            siblings.map((row) => row.id),
          );
          const category = await repository.save(
            repository.create({
              id,
              ...text,
              parentId,
              position: input.position,
              version: 1,
              status: CatalogGroupingStatus.ACTIVE,
              archivedAt: null,
            }),
          );
          const ordered = siblings.map((row) => row.id);
          ordered.splice(input.position, 0, id);
          await this.rewriteSiblings(manager, parentId, ordered);
          await manager.getRepository(CatalogCategorySlug).save({
            categoryId: id,
            slug: text.slug,
            isCanonical: true,
          });
          await this.record(
            transaction,
            audit,
            CommerceAuditAction.CATEGORY_CREATED,
            'category',
            id,
            { parentId, position: input.position },
          );
          return this.category(category);
        },
      );
    } catch (error) {
      throw this.translate(error, 'category');
    }
  }

  async editCategory(
    categoryId: string,
    input: GroupingTextCommand & { readonly expectedVersion: number },
    audit: CatalogAuditContext,
  ): Promise<CategoryProjection> {
    const text = this.categoryText(input);
    return this.categoryCommand(
      categoryId,
      input.expectedVersion,
      audit,
      CommerceAuditAction.CATEGORY_UPDATED,
      async (manager, category) => {
        await this.replaceCategorySlug(manager, category, text.slug);
        Object.assign(category, text);
      },
    );
  }

  async moveCategory(
    categoryId: string,
    input: MoveCategoryCommand,
    audit: CatalogAuditContext,
  ): Promise<CategoryProjection> {
    const parentId = input.parentId ?? null;
    this.position(input.position);
    try {
      return await this.persistence.withTransaction(
        async (manager, transaction) => {
          const categories = await this.lockCategories(manager);
          const category = categories.find((row) => row.id === categoryId);
          if (!category) throw this.notFound('category');
          this.version(category.version, input.expectedVersion);
          const parent = parentId
            ? categories.find((row) => row.id === parentId)
            : undefined;
          if (parentId && parent?.status !== CatalogGroupingStatus.ACTIVE)
            throw this.hierarchy('Parent Category must be active');
          assertCategoryPlacement(categories, categoryId, parentId);
          const previousParentId = category.parentId;
          const previousSiblingIds = this.siblings(
            categories,
            previousParentId,
          ).map((row) => row.id);
          const oldIds = previousSiblingIds.filter((row) => row !== categoryId);
          const newIds =
            previousParentId === parentId
              ? [...oldIds]
              : this.siblings(categories, parentId)
                  .filter((row) => row.id !== categoryId)
                  .map((row) => row.id);
          if (input.position > newIds.length)
            throw this.hierarchy('Category position is outside its siblings');
          await this.parkSiblings(manager, previousSiblingIds);
          if (previousParentId !== parentId)
            await this.parkSiblings(manager, newIds);
          category.parentId = parentId;
          category.position = input.position;
          category.version += 1;
          await manager.getRepository(CatalogCategory).save(category);
          newIds.splice(input.position, 0, categoryId);
          if (previousParentId !== parentId)
            await this.writeSiblingPositions(manager, previousParentId, oldIds);
          await this.writeSiblingPositions(manager, parentId, newIds);
          await this.record(
            transaction,
            audit,
            CommerceAuditAction.CATEGORY_MOVED,
            'category',
            categoryId,
            { previousParentId, parentId, position: input.position },
          );
          return this.category(category);
        },
      );
    } catch (error) {
      throw this.translate(error, 'category');
    }
  }

  archiveCategory(
    categoryId: string,
    expectedVersion: number,
    audit: CatalogAuditContext,
  ): Promise<CategoryProjection> {
    return this.categoryTransition(categoryId, expectedVersion, false, audit);
  }

  restoreCategory(
    categoryId: string,
    expectedVersion: number,
    audit: CatalogAuditContext,
  ): Promise<CategoryProjection> {
    return this.categoryTransition(categoryId, expectedVersion, true, audit);
  }

  async replaceProductCategories(
    productId: string,
    input: ReplaceMembershipCommand,
    audit: CatalogAuditContext,
  ): Promise<{ readonly productId: string; readonly version: number }> {
    const ids = this.distinctIds(
      input.ids,
      CATALOG_NAVIGATION_LIMITS.productCategories,
    );
    try {
      return await this.persistence.withTransaction(
        async (manager, transaction) => {
          const products = manager.getRepository(CatalogProduct);
          const product = await products.findOne({
            where: { id: productId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!product) throw this.notFound('product');
          this.version(product.version, input.expectedVersion);
          if (ids.length) {
            const count = await manager
              .getRepository(CatalogCategory)
              .countBy({ id: In(ids) });
            if (count !== ids.length)
              throw this.membership('One or more Categories were not found');
          }
          const memberships = manager.getRepository(CatalogProductCategory);
          await memberships.delete({ productId });
          if (ids.length)
            await memberships.insert(
              ids.map((categoryId) => ({ productId, categoryId })),
            );
          product.version += 1;
          await products.save(product);
          await this.record(
            transaction,
            audit,
            CommerceAuditAction.PRODUCT_CATEGORIES_REPLACED,
            'product',
            productId,
            { categoryCount: ids.length },
          );
          return { productId, version: product.version };
        },
      );
    } catch (error) {
      throw this.translate(error, 'category');
    }
  }

  async createCollection(
    input: GroupingTextCommand,
    audit: CatalogAuditContext,
  ): Promise<CollectionProjection> {
    const text = this.collectionText(input);
    try {
      return await this.persistence.withTransaction(
        async (manager, transaction) => {
          await manager.query(
            "SELECT pg_advisory_xact_lock(hashtext('catalog_collections'))",
          );
          const repository = manager.getRepository(CatalogCollection);
          if (
            (await repository.count()) >= CATALOG_NAVIGATION_LIMITS.collections
          )
            throw this.validation('Collection limit was reached');
          const collection = await repository.save(
            repository.create({
              ...text,
              version: 1,
              status: CatalogGroupingStatus.ACTIVE,
              archivedAt: null,
            }),
          );
          await manager.getRepository(CatalogCollectionSlug).save({
            collectionId: collection.id,
            slug: text.slug,
            isCanonical: true,
          });
          await this.record(
            transaction,
            audit,
            CommerceAuditAction.COLLECTION_CREATED,
            'collection',
            collection.id,
            {},
          );
          return this.collection(collection);
        },
      );
    } catch (error) {
      throw this.translate(error, 'collection');
    }
  }

  async editCollection(
    collectionId: string,
    input: GroupingTextCommand & { readonly expectedVersion: number },
    audit: CatalogAuditContext,
  ): Promise<CollectionProjection> {
    const text = this.collectionText(input);
    return this.collectionCommand(
      collectionId,
      input.expectedVersion,
      audit,
      CommerceAuditAction.COLLECTION_UPDATED,
      async (manager, collection) => {
        await this.replaceCollectionSlug(manager, collection, text.slug);
        Object.assign(collection, text);
      },
    );
  }

  archiveCollection(
    collectionId: string,
    expectedVersion: number,
    audit: CatalogAuditContext,
  ): Promise<CollectionProjection> {
    return this.collectionTransition(
      collectionId,
      expectedVersion,
      false,
      audit,
    );
  }

  restoreCollection(
    collectionId: string,
    expectedVersion: number,
    audit: CatalogAuditContext,
  ): Promise<CollectionProjection> {
    return this.collectionTransition(
      collectionId,
      expectedVersion,
      true,
      audit,
    );
  }

  async replaceCollectionProducts(
    collectionId: string,
    expectedVersion: number,
    entries: readonly OrderedProductMembership[],
    audit: CatalogAuditContext,
  ): Promise<CollectionProjection> {
    if (entries.length > CATALOG_NAVIGATION_LIMITS.collectionProducts)
      throw this.membership('Collection Product limit was exceeded');
    const ids = this.distinctIds(
      entries.map((entry) => entry.productId),
      CATALOG_NAVIGATION_LIMITS.collectionProducts,
    );
    try {
      assertContiguousPositions(
        entries.map((entry) => entry.position),
        'Collection Product',
      );
      return await this.persistence.withTransaction(
        async (manager, transaction) => {
          const collections = manager.getRepository(CatalogCollection);
          const collection = await collections.findOne({
            where: { id: collectionId },
            lock: { mode: 'pessimistic_write' },
          });
          if (!collection) throw this.notFound('collection');
          this.version(collection.version, expectedVersion);
          if (ids.length) {
            const count = await manager
              .getRepository(CatalogProduct)
              .countBy({ id: In(ids) });
            if (count !== ids.length)
              throw this.membership('One or more Products were not found');
          }
          const memberships = manager.getRepository(CatalogCollectionProduct);
          await memberships.delete({ collectionId });
          if (entries.length)
            await memberships.insert(
              entries.map((entry) => ({ collectionId, ...entry })),
            );
          collection.version += 1;
          await collections.save(collection);
          await this.record(
            transaction,
            audit,
            CommerceAuditAction.COLLECTION_PRODUCTS_REPLACED,
            'collection',
            collectionId,
            { productCount: entries.length },
          );
          return this.collection(collection);
        },
      );
    } catch (error) {
      throw this.translate(error, 'collection');
    }
  }

  async listPublicCategories(): Promise<readonly PublicCategoryProjection[]> {
    const rows = await this.persistence.withTransaction((manager) =>
      manager.getRepository(CatalogCategory).find({
        where: { status: CatalogGroupingStatus.ACTIVE },
        order: { position: 'ASC', id: 'ASC' },
      }),
    );
    const children = new Map<string | null, CatalogCategory[]>();
    for (const row of rows) {
      const siblings = children.get(row.parentId) ?? [];
      siblings.push(row);
      children.set(row.parentId, siblings);
    }
    const ordered: CatalogCategory[] = [];
    const visit = (parentId: string | null) => {
      for (const row of children.get(parentId) ?? []) {
        ordered.push(row);
        visit(row.id);
      }
    };
    visit(null);
    return ordered.map((row) => this.publicCategory(row));
  }

  async resolvePublicCategory(slugInput: string): Promise<{
    readonly category: PublicCategoryProjection;
    readonly canonicalSlug: string;
    readonly requestedSlugIsCanonical: boolean;
  }> {
    const slug = this.normalizeCategorySlug(slugInput);
    const row = await this.persistence.withTransaction((manager) =>
      manager
        .getRepository(CatalogCategorySlug)
        .createQueryBuilder('alias')
        .innerJoinAndSelect('alias.category', 'category')
        .where('alias.slug = :slug', { slug })
        .andWhere('category.status = :status', {
          status: CatalogGroupingStatus.ACTIVE,
        })
        .getOne(),
    );
    const category = (row as unknown as { category?: CatalogCategory })
      ?.category;
    if (!row || !category) throw this.notFound('category');
    return {
      category: this.publicCategory(category),
      canonicalSlug: category.slug,
      requestedSlugIsCanonical: row.isCanonical,
    };
  }

  async listPublicCollections(): Promise<
    readonly PublicCollectionProjection[]
  > {
    const rows = await this.persistence.withTransaction((manager) =>
      manager.getRepository(CatalogCollection).find({
        where: { status: CatalogGroupingStatus.ACTIVE },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    );
    return rows.map((row) => this.publicCollection(row));
  }

  async resolvePublicCollection(slugInput: string): Promise<{
    readonly collection: PublicCollectionProjection;
    readonly canonicalSlug: string;
    readonly requestedSlugIsCanonical: boolean;
  }> {
    const slug = normalizeSlug(slugInput, this.reservedRoutes);
    const row = await this.persistence.withTransaction((manager) =>
      manager
        .getRepository(CatalogCollectionSlug)
        .createQueryBuilder('alias')
        .innerJoinAndSelect('alias.collection', 'collection')
        .where('alias.slug = :slug', { slug })
        .andWhere('collection.status = :status', {
          status: CatalogGroupingStatus.ACTIVE,
        })
        .getOne(),
    );
    const collection = (row as unknown as { collection?: CatalogCollection })
      ?.collection;
    if (!row || !collection) throw this.notFound('collection');
    return {
      collection: this.publicCollection(collection),
      canonicalSlug: collection.slug,
      requestedSlugIsCanonical: row.isCanonical,
    };
  }

  async listAdminCategories(
    input: { status?: CatalogGroupingStatus; q?: string; limit?: number } = {},
  ) {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const rows = await this.persistence.withTransaction((manager) => {
      const query = manager
        .getRepository(CatalogCategory)
        .createQueryBuilder('category')
        .orderBy('category.updatedAt', 'DESC')
        .addOrderBy('category.id', 'DESC')
        .take(limit);
      if (input.status)
        query.andWhere('category.status = :status', { status: input.status });
      if (input.q?.trim())
        query.andWhere('(category.title ILIKE :q OR category.slug ILIKE :q)', {
          q: `${input.q.trim()}%`,
        });
      return query.getMany();
    });
    return {
      items: await Promise.all(rows.map((row) => this.adminCategory(row))),
      nextCursor: null,
    };
  }

  async getAdminCategory(id: string) {
    const row = await this.persistence.withTransaction((manager) =>
      manager.getRepository(CatalogCategory).findOneBy({ id }),
    );
    if (!row) throw this.notFound('category');
    return this.adminCategory(row);
  }

  async listAdminCollections(
    input: { status?: CatalogGroupingStatus; q?: string; limit?: number } = {},
  ) {
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
    const rows = await this.persistence.withTransaction((manager) => {
      const query = manager
        .getRepository(CatalogCollection)
        .createQueryBuilder('collection')
        .orderBy('collection.updatedAt', 'DESC')
        .addOrderBy('collection.id', 'DESC')
        .take(limit);
      if (input.status)
        query.andWhere('collection.status = :status', { status: input.status });
      if (input.q?.trim())
        query.andWhere(
          '(collection.title ILIKE :q OR collection.slug ILIKE :q)',
          { q: `${input.q.trim()}%` },
        );
      return query.getMany();
    });
    return {
      items: await Promise.all(rows.map((row) => this.adminCollection(row))),
      nextCursor: null,
    };
  }

  async getAdminCollection(id: string) {
    const row = await this.persistence.withTransaction((manager) =>
      manager.getRepository(CatalogCollection).findOneBy({ id }),
    );
    if (!row) throw this.notFound('collection');
    return this.adminCollection(row);
  }

  private async categoryTransition(
    id: string,
    expectedVersion: number,
    restore: boolean,
    audit: CatalogAuditContext,
  ): Promise<CategoryProjection> {
    try {
      return await this.persistence.withTransaction(
        async (manager, transaction) => {
          const categories = await this.lockCategories(manager);
          const category = categories.find((row) => row.id === id);
          if (!category) throw this.notFound('category');
          this.version(category.version, expectedVersion);
          const desired = restore
            ? CatalogGroupingStatus.ACTIVE
            : CatalogGroupingStatus.ARCHIVED;
          if (category.status === desired)
            throw new CatalogApplicationError(
              'catalog.category_transition_conflict',
              `Category is already ${desired}`,
            );
          if (
            !restore &&
            categories.some(
              (row) =>
                row.status === CatalogGroupingStatus.ACTIVE &&
                this.isDescendant(categories, row.id, id),
            )
          )
            throw new CatalogApplicationError(
              'catalog.category_transition_conflict',
              'Archive active descendants first',
            );
          if (restore) {
            let parentId = category.parentId;
            while (parentId) {
              const parent = categories.find((row) => row.id === parentId);
              if (!parent || parent.status !== CatalogGroupingStatus.ACTIVE)
                throw new CatalogApplicationError(
                  'catalog.category_transition_conflict',
                  'Restore parent Categories first',
                );
              parentId = parent.parentId;
            }
          }
          category.status = desired;
          category.archivedAt = restore ? null : new Date();
          category.version += 1;
          await manager.getRepository(CatalogCategory).save(category);
          await this.record(
            transaction,
            audit,
            restore
              ? CommerceAuditAction.CATEGORY_RESTORED
              : CommerceAuditAction.CATEGORY_ARCHIVED,
            'category',
            id,
            {},
          );
          return this.category(category);
        },
      );
    } catch (error) {
      throw this.translate(error, 'category');
    }
  }

  private async collectionTransition(
    id: string,
    expectedVersion: number,
    restore: boolean,
    audit: CatalogAuditContext,
  ): Promise<CollectionProjection> {
    return this.collectionCommand(
      id,
      expectedVersion,
      audit,
      restore
        ? CommerceAuditAction.COLLECTION_RESTORED
        : CommerceAuditAction.COLLECTION_ARCHIVED,
      (_manager, collection) => {
        const desired = restore
          ? CatalogGroupingStatus.ACTIVE
          : CatalogGroupingStatus.ARCHIVED;
        if (collection.status === desired)
          throw new CatalogApplicationError(
            'catalog.collection_transition_conflict',
            `Collection is already ${desired}`,
          );
        collection.status = desired;
        collection.archivedAt = restore ? null : new Date();
      },
    );
  }

  private async categoryCommand(
    id: string,
    expectedVersion: number,
    audit: CatalogAuditContext,
    action:
      | typeof CommerceAuditAction.CATEGORY_UPDATED
      | typeof CommerceAuditAction.CATEGORY_ARCHIVED
      | typeof CommerceAuditAction.CATEGORY_RESTORED,
    change: (
      manager: EntityManager,
      category: CatalogCategory,
    ) => Promise<void>,
  ): Promise<CategoryProjection> {
    try {
      return await this.persistence.withTransaction(
        async (manager, transaction) => {
          const repository = manager.getRepository(CatalogCategory);
          const category = await repository.findOne({
            where: { id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!category) throw this.notFound('category');
          this.version(category.version, expectedVersion);
          await change(manager, category);
          category.version += 1;
          await repository.save(category);
          await this.record(transaction, audit, action, 'category', id, {});
          return this.category(category);
        },
      );
    } catch (error) {
      throw this.translate(error, 'category');
    }
  }

  private async collectionCommand(
    id: string,
    expectedVersion: number,
    audit: CatalogAuditContext,
    action:
      | typeof CommerceAuditAction.COLLECTION_UPDATED
      | typeof CommerceAuditAction.COLLECTION_ARCHIVED
      | typeof CommerceAuditAction.COLLECTION_RESTORED,
    change: (
      manager: EntityManager,
      collection: CatalogCollection,
    ) => Promise<void> | void,
  ): Promise<CollectionProjection> {
    try {
      return await this.persistence.withTransaction(
        async (manager, transaction) => {
          const repository = manager.getRepository(CatalogCollection);
          const collection = await repository.findOne({
            where: { id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!collection) throw this.notFound('collection');
          this.version(collection.version, expectedVersion);
          await change(manager, collection);
          collection.version += 1;
          await repository.save(collection);
          await this.record(transaction, audit, action, 'collection', id, {});
          return this.collection(collection);
        },
      );
    } catch (error) {
      throw this.translate(error, 'collection');
    }
  }

  private async replaceCategorySlug(
    manager: EntityManager,
    category: CatalogCategory,
    slug: string,
  ): Promise<void> {
    if (category.slug === slug) return;
    const repository = manager.getRepository(CatalogCategorySlug);
    const reserved = await repository.findOneBy({ slug });
    if (reserved && reserved.categoryId !== category.id)
      throw new CatalogApplicationError(
        'catalog.category_slug_conflict',
        'Category slug is already reserved',
      );
    await repository.update(
      { categoryId: category.id, isCanonical: true },
      { isCanonical: false },
    );
    if (reserved) await repository.update(reserved.id, { isCanonical: true });
    else
      await repository.save({
        categoryId: category.id,
        slug,
        isCanonical: true,
      });
  }

  private async replaceCollectionSlug(
    manager: EntityManager,
    collection: CatalogCollection,
    slug: string,
  ): Promise<void> {
    if (collection.slug === slug) return;
    const repository = manager.getRepository(CatalogCollectionSlug);
    const reserved = await repository.findOneBy({ slug });
    if (reserved && reserved.collectionId !== collection.id)
      throw new CatalogApplicationError(
        'catalog.collection_slug_conflict',
        'Collection slug is already reserved',
      );
    await repository.update(
      { collectionId: collection.id, isCanonical: true },
      { isCanonical: false },
    );
    if (reserved) await repository.update(reserved.id, { isCanonical: true });
    else
      await repository.save({
        collectionId: collection.id,
        slug,
        isCanonical: true,
      });
  }

  private async lockCategories(
    manager: EntityManager,
  ): Promise<CatalogCategory[]> {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtext('catalog_categories_hierarchy'))",
    );
    return manager.getRepository(CatalogCategory).find({
      order: { parentId: 'ASC', position: 'ASC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }

  private siblings(
    categories: readonly CatalogCategory[],
    parentId: string | null,
  ): CatalogCategory[] {
    return categories
      .filter((row) => row.parentId === parentId)
      .sort((left, right) => left.position - right.position);
  }

  private async rewriteSiblings(
    manager: EntityManager,
    parentId: string | null,
    ids: readonly string[],
  ): Promise<void> {
    if (!ids.length) return;
    await this.parkSiblings(manager, ids);
    await this.writeSiblingPositions(manager, parentId, ids);
  }

  private async parkSiblings(
    manager: EntityManager,
    ids: readonly string[],
  ): Promise<void> {
    if (!ids.length) return;
    await manager
      .getRepository(CatalogCategory)
      .createQueryBuilder()
      .update(CatalogCategory)
      .set({ position: () => 'position + 10000' })
      .where('id IN (:...ids)', { ids })
      .execute();
  }

  private async writeSiblingPositions(
    manager: EntityManager,
    parentId: string | null,
    ids: readonly string[],
  ): Promise<void> {
    const repository = manager.getRepository(CatalogCategory);
    for (const [position, id] of ids.entries())
      await repository.update(id, { parentId, position });
  }

  private isDescendant(
    categories: readonly CatalogCategory[],
    candidateId: string,
    ancestorId: string,
  ): boolean {
    let current = categories.find((row) => row.id === candidateId);
    while (current?.parentId) {
      if (current.parentId === ancestorId) return true;
      current = categories.find((row) => row.id === current?.parentId);
    }
    return false;
  }

  private categoryText(input: GroupingTextCommand) {
    return {
      ...this.groupingText(input),
      slug: this.normalizeCategorySlug(input.slug),
    };
  }

  private collectionText(input: GroupingTextCommand) {
    return {
      ...this.groupingText(input),
      slug: normalizeSlug(input.slug, this.reservedRoutes),
    };
  }

  private groupingText(input: GroupingTextCommand) {
    return {
      title: requiredText(
        input.title,
        CATALOG_NAVIGATION_LIMITS.title,
        'title',
      ),
      summary: optionalText(
        input.summary,
        CATALOG_NAVIGATION_LIMITS.summary,
        'summary',
      ),
      description: optionalText(
        input.description,
        CATALOG_NAVIGATION_LIMITS.description,
        'description',
      ),
    };
  }

  private normalizeCategorySlug(value: string): string {
    return normalizeSlug(value, [...this.reservedRoutes, 'navigation']);
  }

  private position(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0)
      throw this.validation('Position must be a non-negative integer');
  }

  private distinctIds(ids: readonly string[], limit: number): string[] {
    if (ids.length > limit)
      throw this.membership('Membership limit was exceeded');
    if (new Set(ids).size !== ids.length)
      throw this.membership('Membership identifiers must be unique');
    return [...ids];
  }

  private version(current: number, expected: number): void {
    if (!Number.isSafeInteger(expected) || expected < 1 || current !== expected)
      throw new CatalogApplicationError(
        'catalog.version_conflict',
        'Catalog record was changed by another request',
        current,
      );
  }

  private async record(
    transaction: DatabaseTransactionContext,
    context: CatalogAuditContext,
    action: CommerceAuditAction,
    targetType: string,
    targetId: string,
    metadata: CommerceAuditMetadata,
  ): Promise<void> {
    await this.audit.record(
      {
        actorUserId: context.actorUserId,
        requestId: context.requestId ?? null,
        action,
        targetType,
        targetId,
        metadata,
      },
      transaction,
    );
  }

  private category(row: CatalogCategory): CategoryProjection {
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      title: row.title,
      summary: row.summary,
      description: row.description,
      slug: row.slug,
      parentId: row.parentId,
      position: row.position,
      archivedAt: row.archivedAt,
    };
  }

  private async adminCategory(row: CatalogCategory) {
    const aliases = await this.persistence.withTransaction((manager) =>
      manager
        .getRepository(CatalogCategorySlug)
        .find({ where: { categoryId: row.id }, order: { createdAt: 'ASC' } }),
    );
    return {
      ...this.category(row),
      aliases: aliases.map((alias) => alias.slug),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt?.toISOString() ?? null,
    };
  }

  private collection(row: CatalogCollection): CollectionProjection {
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      title: row.title,
      summary: row.summary,
      description: row.description,
      slug: row.slug,
      archivedAt: row.archivedAt,
    };
  }

  private async adminCollection(row: CatalogCollection) {
    const [aliases, products] = await this.persistence.withTransaction(
      async (manager) => Promise.all([
        manager
          .getRepository(CatalogCollectionSlug)
          .find({
            where: { collectionId: row.id },
            order: { createdAt: 'ASC' },
          }),
        manager
          .getRepository(CatalogCollectionProduct)
          .find({
            where: { collectionId: row.id },
            order: { position: 'ASC' },
          }),
      ]),
    );
    return {
      ...this.collection(row),
      aliases: aliases.map((alias) => alias.slug),
      products: products.map((item) => ({
        productId: item.productId,
        position: item.position,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      archivedAt: row.archivedAt?.toISOString() ?? null,
    };
  }

  private publicCategory(row: CatalogCategory): PublicCategoryProjection {
    const { id, title, summary, description, slug, parentId, position } = row;
    return { id, title, summary, description, slug, parentId, position };
  }

  private publicCollection(row: CatalogCollection): PublicCollectionProjection {
    const { id, title, summary, description, slug } = row;
    return { id, title, summary, description, slug };
  }

  private validation(message: string): CatalogApplicationError {
    return new CatalogApplicationError('catalog.validation_failed', message);
  }

  private hierarchy(message: string): CatalogApplicationError {
    return new CatalogApplicationError(
      'catalog.category_hierarchy_conflict',
      message,
    );
  }

  private membership(message: string): CatalogApplicationError {
    return new CatalogApplicationError('catalog.membership_conflict', message);
  }

  private notFound(
    kind: 'category' | 'collection' | 'product',
  ): CatalogApplicationError {
    return new CatalogApplicationError(
      kind === 'category'
        ? 'catalog.category_not_found'
        : kind === 'collection'
          ? 'catalog.collection_not_found'
          : 'catalog.not_found',
      `${kind} was not found`,
    );
  }

  private translate(
    error: unknown,
    namespace: 'category' | 'collection',
  ): CatalogApplicationError {
    if (error instanceof CatalogApplicationError) return error;
    if (error instanceof CatalogNavigationRuleError)
      return this.hierarchy(error.message);
    if (error instanceof QueryFailedError) {
      const detail = String(
        (error.driverError as { detail?: unknown })?.detail,
      );
      if (detail.includes('slug'))
        return new CatalogApplicationError(
          namespace === 'category'
            ? 'catalog.category_slug_conflict'
            : 'catalog.collection_slug_conflict',
          `${namespace} slug is already reserved`,
        );
      if (detail.includes('position'))
        return namespace === 'category'
          ? this.hierarchy('Category position conflicts with a sibling')
          : this.membership('Collection Product positions conflict');
    }
    return this.validation('Catalog navigation command could not be completed');
  }
}
