import type { DatabaseTransactionContext } from '../../platform/database';
import type { Money } from '../pricing';
import {
  ManualPaymentMethod,
  ManualPaymentStatus,
} from './manual-payment.entity';

export const PAYMENTS_MODULE_CONTRACT = Symbol('payments-module-contract');

export interface ManualPaymentView {
  readonly id: string;
  readonly orderId: string;
  readonly method: ManualPaymentMethod;
  readonly status: ManualPaymentStatus;
  readonly expectedAmount: Money;
}

export interface PaymentsModuleContract {
  listManualPaymentMethods(): readonly ManualPaymentMethod[];
  createManualPayment(
    input: {
      orderId: string;
      method: ManualPaymentMethod;
      expectedAmount: Money;
    },
    transaction: DatabaseTransactionContext,
  ): Promise<ManualPaymentView>;
  getForOrder(
    orderId: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<ManualPaymentView | null>;
  confirmManualPayment(
    orderId: string,
    actorUserId: string,
    reference: string | undefined,
    note: string | undefined,
    transaction?: DatabaseTransactionContext,
    requestId?: string | null,
  ): Promise<ManualPaymentView>;
  rejectManualPayment(
    orderId: string,
    actorUserId: string,
    note: string | undefined,
    transaction?: DatabaseTransactionContext,
  ): Promise<ManualPaymentView>;
  cancelManualPayment(
    orderId: string,
    reason: string,
    transaction: DatabaseTransactionContext,
  ): Promise<ManualPaymentView>;
}

export { ManualPaymentMethod, ManualPaymentStatus };
