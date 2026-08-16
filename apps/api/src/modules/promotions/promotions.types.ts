import type { Money } from '../pricing';

export type PromotionStatus =
  'draft' | 'scheduled' | 'active' | 'paused' | 'ended';

export type PromotionEligibility = 'public' | 'code_required';
export type PromotionRuleKind = 'percentage' | 'fixed_amount';
export type PromotionTargetKind =
  'cart' | 'variants' | 'categories' | 'collections';

export interface PromotionTarget {
  readonly kind: PromotionTargetKind;
  readonly ids: readonly string[];
}

export interface PromotionRule {
  readonly kind: PromotionRuleKind;
  readonly percentage?: string;
  readonly amount?: Money;
}

export interface PromotionDefinitionInput {
  readonly name: string;
  readonly description?: string | null;
  readonly eligibility: PromotionEligibility;
  readonly code?: string | null;
  readonly rule: PromotionRule;
  readonly target: PromotionTarget;
  readonly priority: number;
  readonly startsAt: Date;
  readonly endsAt?: Date | null;
  readonly totalLimit?: number | null;
  readonly perCustomerLimit?: number | null;
}

export interface PromotionDefinition extends PromotionDefinitionInput {
  readonly id: string;
  readonly promotionId: string;
  readonly version: number;
}

export interface PromotionLineInput {
  readonly variantId: string;
  readonly amount: Money;
  readonly categoryIds?: readonly string[];
  readonly collectionIds?: readonly string[];
}

export interface PromotionLineAllocation {
  readonly variantId: string;
  readonly amount: Money;
}

export interface PromotionQuote {
  readonly status: 'applied' | 'not_applied';
  readonly promotionId: string | null;
  readonly definitionVersion: string | null;
  readonly name: string | null;
  readonly code: string | null;
  readonly discount: Money;
  readonly allocations: readonly PromotionLineAllocation[];
  readonly reason:
    | 'missing_code'
    | 'invalid_code'
    | 'not_started'
    | 'ended'
    | 'paused'
    | 'not_eligible'
    | 'limit_reached'
    | 'no_eligible_lines'
    | null;
}
