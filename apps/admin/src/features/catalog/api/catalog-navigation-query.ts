import { mutationOptions, queryOptions } from '@tanstack/react-query';
import {
  createAdminCategory,
  createAdminCollection,
  getAdminCategory,
  getAdminCollection,
  listAdminCategories,
  listAdminCollections,
  moveAdminCategory,
  replaceAdminProductCategories,
  replaceAdminCollectionProducts,
  transitionAdminCategory,
  transitionAdminCollection,
  updateAdminCategory,
  updateAdminCollection,
} from './catalog-navigation-api';

export const catalogNavigationKeys = {
  all: ['admin', 'catalog-navigation'] as const,
  categories: () => [...catalogNavigationKeys.all, 'categories'] as const,
  category: (id: string) =>
    [...catalogNavigationKeys.categories(), id] as const,
  collections: () => [...catalogNavigationKeys.all, 'collections'] as const,
  collection: (id: string) =>
    [...catalogNavigationKeys.collections(), id] as const,
};
export const categoriesQuery = () =>
  queryOptions({
    queryKey: catalogNavigationKeys.categories(),
    queryFn: ({ signal }) => listAdminCategories(signal),
  });
export const categoryQuery = (id: string) =>
  queryOptions({
    queryKey: catalogNavigationKeys.category(id),
    queryFn: ({ signal }) => getAdminCategory(id, signal),
    enabled: Boolean(id),
  });
export const collectionsQuery = () =>
  queryOptions({
    queryKey: catalogNavigationKeys.collections(),
    queryFn: ({ signal }) => listAdminCollections(signal),
  });
export const collectionQuery = (id: string) =>
  queryOptions({
    queryKey: catalogNavigationKeys.collection(id),
    queryFn: ({ signal }) => getAdminCollection(id, signal),
    enabled: Boolean(id),
  });
export const createCategoryMutation = () =>
  mutationOptions({ mutationFn: createAdminCategory });
export const updateCategoryMutation = () =>
  mutationOptions({
    mutationFn: ({
      id,
      ...input
    }: Parameters<typeof updateAdminCategory>[1] & { id: string }) =>
      updateAdminCategory(id, input),
  });
export const moveCategoryMutation = () =>
  mutationOptions({
    mutationFn: ({
      id,
      ...input
    }: Parameters<typeof moveAdminCategory>[1] & { id: string }) =>
      moveAdminCategory(id, input),
  });
export const transitionCategoryMutation = () =>
  mutationOptions({
    mutationFn: ({
      id,
      action,
      expectedVersion,
    }: {
      id: string;
      action: 'archive' | 'restore';
      expectedVersion: number;
    }) => transitionAdminCategory(id, action, expectedVersion),
  });
export const productCategoriesMutation = () =>
  mutationOptions({
    mutationFn: ({
      id,
      expectedVersion,
      categoryIds,
    }: {
      id: string;
      expectedVersion: number;
      categoryIds: string[];
    }) => replaceAdminProductCategories(id, expectedVersion, categoryIds),
  });
export const createCollectionMutation = () =>
  mutationOptions({ mutationFn: createAdminCollection });
export const updateCollectionMutation = () =>
  mutationOptions({
    mutationFn: ({
      id,
      ...input
    }: Parameters<typeof updateAdminCollection>[1] & { id: string }) =>
      updateAdminCollection(id, input),
  });
export const productsCollectionMutation = () =>
  mutationOptions({
    mutationFn: ({
      id,
      expectedVersion,
      items,
    }: {
      id: string;
      expectedVersion: number;
      items: { productId: string; position: number }[];
    }) => replaceAdminCollectionProducts(id, expectedVersion, items),
  });
export const transitionCollectionMutation = () =>
  mutationOptions({
    mutationFn: ({
      id,
      action,
      expectedVersion,
    }: {
      id: string;
      action: 'archive' | 'restore';
      expectedVersion: number;
    }) => transitionAdminCollection(id, action, expectedVersion),
  });
