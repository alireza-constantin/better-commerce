import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { DatabaseTransactionContext } from '../../platform/database';
import { unwrapTypeOrmTransaction } from '../../platform/database/typeorm-transaction-context';
import { ManualPaymentHistory } from './manual-payment-history.entity';
import {
  ManualPayment,
  ManualPaymentMethod,
  ManualPaymentStatus,
} from './manual-payment.entity';
import type {
  ManualPaymentView,
  PaymentsModuleContract,
} from './payments.contract';

@Injectable()
export class PaymentsService implements PaymentsModuleContract {
  constructor(private readonly dataSource: DataSource) {}

  async createManualPayment(
    input: {
      orderId: string;
      method: ManualPaymentMethod;
      expectedAmount: { minorAmount: bigint; currency: string };
    },
    transaction: DatabaseTransactionContext,
  ): Promise<ManualPaymentView> {
    const manager = unwrapTypeOrmTransaction(transaction);
    const status =
      input.method === ManualPaymentMethod.BANK_TRANSFER
        ? ManualPaymentStatus.PENDING_MANUAL_REVIEW
        : ManualPaymentStatus.PENDING_COLLECTION;
    const payment = await manager.getRepository(ManualPayment).save({
      orderId: input.orderId,
      method: input.method,
      status,
      expectedMinorAmount: input.expectedAmount.minorAmount.toString(),
      currency: input.expectedAmount.currency,
    });
    await this.record(manager, payment, null, status, null, null, null);
    return this.toView(payment);
  }

  async getForOrder(
    orderId: string,
    transaction?: DatabaseTransactionContext,
  ): Promise<ManualPaymentView | null> {
    const manager = transaction
      ? unwrapTypeOrmTransaction(transaction)
      : this.dataSource.manager;
    const payment = await manager.getRepository(ManualPayment).findOne({
      where: { orderId },
    });
    return payment ? this.toView(payment) : null;
  }

  confirmManualPayment(
    orderId: string,
    actorUserId: string,
    reference: string | undefined,
    note: string | undefined,
    transaction?: DatabaseTransactionContext,
  ): Promise<ManualPaymentView> {
    return this.transition(
      orderId,
      ManualPaymentStatus.CONFIRMED,
      actorUserId,
      reference,
      note,
      transaction,
    );
  }

  rejectManualPayment(
    orderId: string,
    actorUserId: string,
    note: string | undefined,
    transaction?: DatabaseTransactionContext,
  ): Promise<ManualPaymentView> {
    return this.transition(
      orderId,
      ManualPaymentStatus.REJECTED,
      actorUserId,
      undefined,
      note,
      transaction,
    );
  }

  cancelManualPayment(
    orderId: string,
    reason: string,
    transaction: DatabaseTransactionContext,
  ): Promise<ManualPaymentView> {
    return this.transition(
      orderId,
      ManualPaymentStatus.CANCELLED,
      null,
      undefined,
      reason,
      transaction,
    );
  }

  private async transition(
    orderId: string,
    next: ManualPaymentStatus,
    actorUserId: string | null,
    reference: string | undefined,
    note: string | undefined,
    transaction?: DatabaseTransactionContext,
  ): Promise<ManualPaymentView> {
    return this.inTransaction(transaction, async (manager) => {
      const repository = manager.getRepository(ManualPayment);
      const payment = await repository.findOne({
        where: { orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!payment) throw new Error('Manual payment was not found');
      if (
        payment.status === ManualPaymentStatus.CONFIRMED ||
        payment.status === ManualPaymentStatus.REJECTED ||
        payment.status === ManualPaymentStatus.CANCELLED
      ) {
        if (payment.status === next) return this.toView(payment);
        throw new Error('Manual payment is already terminal');
      }
      const previous = payment.status;
      payment.status = next;
      await repository.save(payment);
      await this.record(
        manager,
        payment,
        previous,
        next,
        actorUserId,
        reference,
        note,
      );
      return this.toView(payment);
    });
  }

  private record(
    manager: EntityManager,
    payment: ManualPayment,
    fromStatus: ManualPaymentStatus | null,
    toStatus: ManualPaymentStatus,
    actorUserId: string | null,
    reference: string | null | undefined,
    note: string | null | undefined,
  ) {
    return manager.getRepository(ManualPaymentHistory).save({
      paymentId: payment.id,
      fromStatus,
      toStatus,
      actorUserId,
      safeReference: reference?.trim() || null,
      note: note?.trim() || null,
    });
  }

  private inTransaction<T>(
    transaction: DatabaseTransactionContext | undefined,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return transaction
      ? work(unwrapTypeOrmTransaction(transaction))
      : this.dataSource.transaction(work);
  }

  private toView(payment: ManualPayment): ManualPaymentView {
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      status: payment.status,
      expectedAmount: {
        minorAmount: BigInt(payment.expectedMinorAmount),
        currency: payment.currency,
      },
    };
  }
}
