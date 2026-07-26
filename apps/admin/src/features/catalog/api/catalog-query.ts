import { mutationOptions, queryOptions } from '@tanstack/react-query';
import {
  createAdminProduct,
  getAdminProduct,
  listAdminProducts,
  replaceProductConfiguration,
  transitionAdminProduct,
  updateAdminProduct,
  type AdminProductsListInput,
} from './catalog-api';

export const adminCatalogQueryKeys = {
  all: ['admin', 'catalog'] as const,
  lists: () => [...adminCatalogQueryKeys.all, 'list'] as const,
  list: (input: AdminProductsListInput) =>
    [...adminCatalogQueryKeys.lists(), input] as const,
  details: () => [...adminCatalogQueryKeys.all, 'detail'] as const,
  detail: (productId: string) =>
    [...adminCatalogQueryKeys.details(), productId] as const,
};

export const adminProductsListQueryOptions = (input: AdminProductsListInput) =>
  queryOptions({
    queryKey: adminCatalogQueryKeys.list(input),
    queryFn: ({ signal }) => listAdminProducts(input, signal),
  });

export const adminProductDetailQueryOptions = (productId: string) =>
  queryOptions({
    queryKey: adminCatalogQueryKeys.detail(productId),
    queryFn: ({ signal }) => getAdminProduct(productId, signal),
    enabled: productId.length > 0,
  });

// Catalog changes wait for the server response; callers invalidate affected
// list/detail queries afterwards rather than making authority assumptions.
export const createAdminProductMutationOptions = () =>
  mutationOptions({ mutationFn: createAdminProduct });
export const updateAdminProductMutationOptions = () =>
  mutationOptions({ mutationFn: updateAdminProduct });
export const replaceProductConfigurationMutationOptions = () =>
  mutationOptions({ mutationFn: replaceProductConfiguration });
export const transitionAdminProductMutationOptions = () =>
  mutationOptions({ mutationFn: transitionAdminProduct });
