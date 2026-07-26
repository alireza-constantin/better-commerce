import { currencyScale, formatMoney, parseMoney } from './money';

describe('Money', () => {
  it('round-trips exact decimal amounts without floating point', () => {
    const money = parseMoney('1234567.89', 'usd');

    expect(money).toEqual({
      minorAmount: 123456789n,
      currency: 'USD',
    });
    expect(formatMoney(money)).toEqual({
      amount: '1234567.89',
      currency: 'USD',
    });
  });

  it('supports zero-decimal currencies', () => {
    expect(parseMoney('1000000', 'IRR')).toEqual({
      minorAmount: 1000000n,
      currency: 'IRR',
    });
    expect(formatMoney({ minorAmount: 5n, currency: 'IRR' }).amount).toBe('5');
  });

  it('rejects unsupported precision, signs, exponent notation, and overflow', () => {
    expect(() => parseMoney('1.001', 'USD')).toThrow('currency scale');
    expect(() => parseMoney('-1.00', 'USD')).toThrow('Invalid money');
    expect(() => parseMoney('1e3', 'USD')).toThrow('Invalid money');
    expect(() => parseMoney('92233720368547758.08', 'USD')).toThrow(
      'supported range',
    );
    expect(() => currencyScale('BTC')).toThrow('Unsupported currency');
  });
});
