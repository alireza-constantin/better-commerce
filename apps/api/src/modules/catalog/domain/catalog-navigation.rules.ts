export const CATALOG_NAVIGATION_LIMITS = Object.freeze({
  categories: 500,
  categoryDepth: 5,
  productCategories: 20,
  collections: 500,
  collectionProducts: 1_000,
  title: 160,
  summary: 500,
  description: 10_000,
});

export interface CategoryPlacementFact {
  readonly id: string;
  readonly parentId: string | null;
}

export class CatalogNavigationRuleError extends Error {}

export function assertCategoryPlacement(
  categories: readonly CategoryPlacementFact[],
  categoryId: string,
  parentId: string | null,
): void {
  if (parentId === categoryId)
    throw new CatalogNavigationRuleError('Category cannot parent itself');
  const byId = new Map(categories.map((category) => [category.id, category]));
  if (parentId && !byId.has(parentId))
    throw new CatalogNavigationRuleError('Parent Category was not found');

  let ancestorDepth = 0;
  let currentId = parentId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === categoryId)
      throw new CatalogNavigationRuleError(
        'Category cannot move below its descendant',
      );
    if (visited.has(currentId))
      throw new CatalogNavigationRuleError(
        'Category hierarchy contains a cycle',
      );
    visited.add(currentId);
    ancestorDepth += 1;
    currentId = byId.get(currentId)?.parentId ?? null;
  }

  const children = new Map<string, string[]>();
  for (const category of categories) {
    if (!category.parentId) continue;
    const entries = children.get(category.parentId) ?? [];
    entries.push(category.id);
    children.set(category.parentId, entries);
  }
  const subtreeDepth = maximumSubtreeDepth(categoryId, children, new Set());
  if (ancestorDepth + subtreeDepth > CATALOG_NAVIGATION_LIMITS.categoryDepth)
    throw new CatalogNavigationRuleError(
      `Category hierarchy cannot exceed ${CATALOG_NAVIGATION_LIMITS.categoryDepth} levels`,
    );
}

export function assertContiguousPositions(
  positions: readonly number[],
  label: string,
): void {
  const ordered = [...positions].sort((left, right) => left - right);
  if (
    ordered.some(
      (position, index) =>
        !Number.isSafeInteger(position) || position !== index,
    )
  )
    throw new CatalogNavigationRuleError(
      `${label} positions must be unique and contiguous from zero`,
    );
}

function maximumSubtreeDepth(
  categoryId: string,
  children: ReadonlyMap<string, readonly string[]>,
  visiting: Set<string>,
): number {
  if (visiting.has(categoryId))
    throw new CatalogNavigationRuleError('Category hierarchy contains a cycle');
  visiting.add(categoryId);
  const childDepths = (children.get(categoryId) ?? []).map((childId) =>
    maximumSubtreeDepth(childId, children, visiting),
  );
  visiting.delete(categoryId);
  return 1 + (childDepths.length ? Math.max(...childDepths) : 0);
}
