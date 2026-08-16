import {
  calculateDiscount,
  normalizeDefinition,
  parsePercentage,
} from './promotions.domain';

const usd = (amount: bigint) => ({ minorAmount: amount, currency: 'USD' });

describe('Promotions domain', () => {
  it('normalizes public definitions and validates exact percentages', () => {
    const definition = normalizeDefinition(
      {
        name: '  Summer  ',
        eligibility: 'public',
        rule: { kind: 'percentage', percentage: '15' },
        target: { kind: 'cart', ids: [] },
        priority: 5,
        startsAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      'USD',
    );
    expect(definition.name).toBe('Summer');
    expect(definition.rule).toEqual({
      kind: 'percentage',
      percentage: '15.00',
    });
    expect(parsePercentage('15.25')).toBe(1525);
  });

  it('allocates percentage discounts deterministically in minor units', () => {
    const quote = calculateDiscount(
      {
        id: 'promotion',
        definitionVersion: 'definition',
        name: 'Summer',
        code: null,
        rule: { kind: 'percentage', percentage: '33.33' },
        target: { kind: 'cart', ids: [] },
      },
      [
        { variantId: 'b', amount: usd(100n) },
        { variantId: 'a', amount: usd(100n) },
      ],
      'USD',
    );
    expect(quote.discount).toEqual(usd(66n));
    expect(quote.allocations).toEqual([
      { variantId: 'b', amount: usd(33n) },
      { variantId: 'a', amount: usd(33n) },
    ]);
  });

  it('caps fixed discounts and targets only matching variants', () => {
    const quote = calculateDiscount(
      {
        id: 'promotion',
        definitionVersion: 'definition',
        name: 'Fixed',
        code: 'FIXED',
        rule: { kind: 'fixed_amount', amount: usd(500) },
        target: { kind: 'variants', ids: ['target'] },
      },
      [
        { variantId: 'target', amount: usd(200n) },
        { variantId: 'other', amount: usd(1000n) },
      ],
      'USD',
    );
    expect(quote.discount).toEqual(usd(200n));
    expect(quote.allocations).toEqual([
      { variantId: 'target', amount: usd(200n) },
    ]);
  });

  it('rejects code and currency violations', () => {
    expect(() =>
      normalizeDefinition(
        {
          name: 'Code',
          eligibility: 'code_required',
          rule: { kind: 'percentage', percentage: '10' },
          target: { kind: 'cart', ids: [] },
          priority: 0,
          startsAt: new Date(),
        },
        'USD',
      ),
    ).toThrow('code');
    expect(() =>
      calculateDiscount(
        {
          id: 'promotion',
          definitionVersion: 'definition',
          name: 'x',
          code: null,
          rule: { kind: 'percentage', percentage: '10' },
          target: { kind: 'cart', ids: [] },
        },
        [
          {
            variantId: 'variant',
            amount: { minorAmount: 1n, currency: 'EUR' },
          },
        ],
        'USD',
      ),
    ).toThrow('currency');
  });
});
