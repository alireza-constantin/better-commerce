import { formatMoney, parseMoney } from '../pricing';
import { PromotionDomainError } from './promotions.errors';
import type {
  PromotionDefinitionInput,
  PromotionLineAllocation,
  PromotionLineInput,
  PromotionQuote,
  PromotionRule,
} from './promotions.types';

const MAX_NAME_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_PRIORITY = 1_000_000;
const MAX_TOTAL_LIMIT = 10_000_000;
const MAX_PER_CUSTOMER_LIMIT = 1_000;

export function normalizePromotionCode(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(normalized)) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Promotion code is invalid',
    );
  }
  return normalized;
}

export function parsePercentage(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Percentage is invalid',
    );
  }
  const [whole, fraction = ''] = value.split('.');
  const basisPoints = Number(`${whole}${fraction.padEnd(2, '0')}`);
  if (
    !Number.isSafeInteger(basisPoints) ||
    basisPoints <= 0 ||
    basisPoints > 10_000
  ) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Percentage must be greater than zero and at most 100%',
    );
  }
  return basisPoints;
}

export function formatPercentage(basisPoints: number): string {
  return `${Math.floor(basisPoints / 100)}.${String(basisPoints % 100).padStart(2, '0')}`;
}

export function normalizeDefinition(
  input: PromotionDefinitionInput,
  currency: string,
): PromotionDefinitionInput & {
  readonly code: string | null;
  readonly description: string | null;
  readonly rule: PromotionRule;
  readonly target: PromotionDefinitionInput['target'];
  readonly totalLimit: number | null;
  readonly perCustomerLimit: number | null;
} {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  if (!name || name.length > MAX_NAME_LENGTH) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Promotion name is invalid',
    );
  }
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Promotion description is too long',
    );
  }
  if (
    !Number.isInteger(input.priority) ||
    input.priority < 0 ||
    input.priority > MAX_PRIORITY
  ) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Promotion priority is invalid',
    );
  }
  if (
    !(input.startsAt instanceof Date) ||
    Number.isNaN(input.startsAt.getTime())
  ) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Promotion start time is invalid',
    );
  }
  if (input.endsAt && input.endsAt <= input.startsAt) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Promotion end time must be after its start time',
    );
  }
  if (input.eligibility === 'code_required' && !input.code) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'A code is required for code-only promotions',
    );
  }
  const code = input.code ? normalizePromotionCode(input.code) : null;
  if (input.eligibility === 'public' && code) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Public promotions cannot have a code',
    );
  }
  const ids = [...new Set(input.target.ids)];
  if (input.target.kind === 'cart' && ids.length) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Cart promotions cannot contain target IDs',
    );
  }
  if (input.target.kind !== 'cart' && !ids.length) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Targeted promotions require at least one target',
    );
  }
  if (ids.length > 500) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Promotion has too many targets',
    );
  }
  const rule = normalizeRule(input.rule, currency);
  const totalLimit = normalizeLimit(input.totalLimit, MAX_TOTAL_LIMIT);
  const perCustomerLimit = normalizeLimit(
    input.perCustomerLimit,
    MAX_PER_CUSTOMER_LIMIT,
  );
  return {
    ...input,
    name,
    description,
    code,
    rule,
    target: { kind: input.target.kind, ids },
    totalLimit,
    perCustomerLimit,
  };
}

function normalizeRule(rule: PromotionRule, currency: string): PromotionRule {
  if (rule.kind === 'percentage') {
    if (!rule.percentage) {
      throw new PromotionDomainError(
        'promotion.validation_failed',
        'Percentage rule requires a percentage',
      );
    }
    return {
      kind: 'percentage',
      percentage: formatPercentage(parsePercentage(rule.percentage)),
    };
  }
  if (!rule.amount) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Fixed rule requires an amount',
    );
  }
  if (rule.amount.currency !== currency) {
    throw new PromotionDomainError(
      'promotion.currency_mismatch',
      'Fixed discount currency does not match the store currency',
    );
  }
  const amount = parseMoney(formatMoney(rule.amount).amount, currency);
  if (amount.minorAmount <= 0n) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Fixed discount must be positive',
    );
  }
  return { kind: 'fixed_amount', amount };
}

function normalizeLimit(
  value: number | null | undefined,
  maximum: number,
): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new PromotionDomainError(
      'promotion.validation_failed',
      'Promotion redemption limit is invalid',
    );
  }
  return value;
}

export function calculateDiscount(
  definition: {
    readonly id: string;
    readonly definitionVersion: string;
    readonly name: string;
    readonly code: string | null;
    readonly rule: PromotionRule;
    readonly target: PromotionDefinitionInput['target'];
  },
  lines: readonly PromotionLineInput[],
  currency: string,
): PromotionQuote {
  const eligible = lines.filter((line) =>
    matchesTarget(definition.target, line),
  );
  if (!eligible.length) {
    return emptyQuote('no_eligible_lines', currency);
  }
  const amounts = eligible.map((line) => {
    if (line.amount.currency !== currency || line.amount.minorAmount < 0n) {
      throw new PromotionDomainError(
        'promotion.currency_mismatch',
        'Promotion input currency does not match the store currency',
      );
    }
    return line.amount.minorAmount;
  });
  const total = amounts.reduce((sum, amount) => sum + amount, 0n);
  if (total <= 0n) return emptyQuote('no_eligible_lines', currency);
  const allocation = allocate(
    definition.rule,
    eligible,
    amounts,
    total,
    currency,
  );
  const discountMinorAmount = allocation.reduce(
    (sum, item) => sum + item.amount.minorAmount,
    0n,
  );
  return {
    status: 'applied',
    promotionId: definition.id,
    definitionVersion: definition.definitionVersion,
    name: definition.name,
    code: definition.code,
    discount: { minorAmount: discountMinorAmount, currency },
    allocations: allocation,
    reason: null,
  };
}

function matchesTarget(
  target: PromotionDefinitionInput['target'],
  line: PromotionLineInput,
): boolean {
  if (target.kind === 'cart') return true;
  const values =
    target.kind === 'variants'
      ? [line.variantId]
      : target.kind === 'categories'
        ? (line.categoryIds ?? [])
        : (line.collectionIds ?? []);
  return values.some((value) => target.ids.includes(value));
}

function allocate(
  rule: PromotionRule,
  lines: readonly PromotionLineInput[],
  amounts: readonly bigint[],
  subtotal: bigint,
  currency: string,
): readonly PromotionLineAllocation[] {
  const denominator = rule.kind === 'percentage' ? 10_000n : subtotal;
  const requestedFixedAmount =
    rule.kind === 'fixed_amount'
      ? parseMoney(formatMoney(rule.amount!).amount, currency).minorAmount
      : null;
  const numeratorMultiplier =
    rule.kind === 'percentage'
      ? BigInt(parsePercentage(rule.percentage ?? '0'))
      : requestedFixedAmount! > subtotal
        ? subtotal
        : requestedFixedAmount!;
  const requested =
    rule.kind === 'percentage'
      ? (subtotal * numeratorMultiplier) / denominator
      : numeratorMultiplier;
  const floors = amounts.map((amount) => {
    const numerator = amount * numeratorMultiplier;
    return {
      floor: numerator / denominator,
      remainder: numerator % denominator,
    };
  });
  let remaining =
    requested - floors.reduce((sum, value) => sum + value.floor, 0n);
  const order = floors
    .map((value, index) => ({
      ...value,
      index,
      variantId: lines[index].variantId,
    }))
    .sort((left, right) =>
      right.remainder > left.remainder
        ? 1
        : right.remainder < left.remainder
          ? -1
          : left.variantId.localeCompare(right.variantId),
    );
  const extras = new Set<number>();
  for (const item of order) {
    if (remaining <= 0n) break;
    extras.add(item.index);
    remaining -= 1n;
  }
  return floors.map((value, index) => ({
    variantId: lines[index].variantId,
    amount: {
      minorAmount: value.floor + (extras.has(index) ? 1n : 0n),
      currency,
    },
  }));
}

function emptyQuote(
  reason: PromotionQuote['reason'],
  currency: string,
): PromotionQuote {
  return {
    status: 'not_applied',
    promotionId: null,
    definitionVersion: null,
    name: null,
    code: null,
    discount: { minorAmount: 0n, currency },
    allocations: [],
    reason,
  };
}
