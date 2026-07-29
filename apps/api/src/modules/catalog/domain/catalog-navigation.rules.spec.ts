import {
  assertCategoryPlacement,
  assertContiguousPositions,
} from './catalog-navigation.rules';

describe('Catalog navigation rules', () => {
  const tree = [
    { id: 'root', parentId: null },
    { id: 'child', parentId: 'root' },
    { id: 'grandchild', parentId: 'child' },
  ];

  it('rejects self-parenting and descendant cycles', () => {
    expect(() => assertCategoryPlacement(tree, 'root', 'root')).toThrow();
    expect(() => assertCategoryPlacement(tree, 'root', 'grandchild')).toThrow(
      'descendant',
    );
  });

  it('accounts for the complete moved subtree when checking depth', () => {
    const deepParent = [
      ...tree,
      { id: 'other-root', parentId: null },
      { id: 'level-2', parentId: 'other-root' },
      { id: 'level-3', parentId: 'level-2' },
      { id: 'level-4', parentId: 'level-3' },
    ];
    expect(() =>
      assertCategoryPlacement(deepParent, 'child', 'level-4'),
    ).toThrow('5 levels');
  });

  it('accepts bounded moves and contiguous positions', () => {
    expect(() =>
      assertCategoryPlacement(tree, 'grandchild', null),
    ).not.toThrow();
    expect(() =>
      assertContiguousPositions([2, 0, 1], 'Collection'),
    ).not.toThrow();
    expect(() => assertContiguousPositions([0, 2], 'Collection')).toThrow(
      'contiguous',
    );
  });
});
