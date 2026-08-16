import type { DatabaseTransactionContext } from '../../platform/database';
import type { Money } from '../pricing';
import type {
  PromotionDefinition,
  PromotionDefinitionInput,
  PromotionLineInput,
  PromotionQuote,
  PromotionStatus,
} from './promotions.types';

export const PROMOTIONS_MODULE_CONTRACT = Symbol('promotions-module-contract');

export interface PromotionQuoteInput {
  readonly definition: PromotionDefinition;
  readonly lines: readonly PromotionLineInput[];
  readonly currency: string;
}

export interface PromotionsModuleContract {
  calculateDiscount(input: PromotionQuoteInput): PromotionQuote;
  createDraft(input: {
    readonly definition: PromotionDefinitionInput;
    readonly actorUserId: string;
    readonly requestId?: string | null;
  }): Promise<unknown>;
  replaceDefinition(input: {
    readonly promotionId: string;
    readonly expectedVersion: number;
    readonly definition: PromotionDefinitionInput;
    readonly actorUserId: string;
    readonly requestId?: string | null;
  }): Promise<unknown>;
  transition(input: {
    readonly promotionId: string;
    readonly expectedVersion: number;
    readonly status: Extract<
      PromotionStatus,
      'scheduled' | 'active' | 'paused' | 'ended'
    >;
    readonly actorUserId: string;
    readonly requestId?: string | null;
  }): Promise<unknown>;
  claimRedemption(input: {
    readonly promotionId: string;
    readonly definitionVersionId: string;
    readonly orderId: string;
    readonly customerId: string;
    readonly discount: Money;
    readonly transaction: DatabaseTransactionContext;
  }): Promise<void>;
}
