import { Injectable } from '@nestjs/common';
import { DataSource, type DeepPartial, type EntityManager } from 'typeorm';
import type { DatabaseTransactionContext } from '../../../platform/database';
import { unwrapTypeOrmTransaction } from '../../../platform/database/typeorm-transaction-context';
import { CommerceOrderLine } from '../commerce-order-line.entity';
import { CommerceOrder } from '../commerce-order.entity';

@Injectable()
export class OrdersPersistence {
  constructor(private readonly dataSource: DataSource) {}

  findByIdempotency(
    userId: string,
    idempotencyKey: string,
    transaction?: DatabaseTransactionContext,
  ) {
    return this.manager(transaction).getRepository(CommerceOrder).findOne({
      where: { userId, idempotencyKey },
    });
  }

  async createOrder(
    order: DeepPartial<CommerceOrder>,
    lines: readonly DeepPartial<CommerceOrderLine>[],
    transaction: DatabaseTransactionContext,
  ) {
    const manager = this.manager(transaction);
    const saved = await manager
      .getRepository(CommerceOrder)
      .save(manager.getRepository(CommerceOrder).create(order));
    await manager
      .getRepository(CommerceOrderLine)
      .save(
        lines.map((line) =>
          manager.getRepository(CommerceOrderLine).create(line),
        ),
      );
    return saved;
  }

  listForCustomer(
    userId: string,
    cursor: { submittedAt: string; id: string } | undefined,
    limit: number,
  ) {
    const query = this.listQuery(cursor, limit).andWhere(
      'commerceOrder.userId = :userId',
      { userId },
    );
    return query.getMany();
  }

  findForCustomer(userId: string, orderId: string) {
    return this.dataSource.getRepository(CommerceOrder).findOne({
      where: { id: orderId, userId },
    });
  }

  listForAdmin(
    cursor: { submittedAt: string; id: string } | undefined,
    limit: number,
  ) {
    return this.listQuery(cursor, limit).getMany();
  }

  findForAdmin(orderId: string) {
    return this.dataSource.getRepository(CommerceOrder).findOneBy({
      id: orderId,
    });
  }

  lockForDecision(orderId: string, transaction: DatabaseTransactionContext) {
    return this.manager(transaction)
      .getRepository(CommerceOrder)
      .findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
  }

  save(order: CommerceOrder, transaction: DatabaseTransactionContext) {
    return this.manager(transaction).getRepository(CommerceOrder).save(order);
  }

  listLines(orderId: string, transaction?: DatabaseTransactionContext) {
    return this.manager(transaction)
      .getRepository(CommerceOrderLine)
      .find({
        where: { orderId },
        order: { id: 'ASC' },
      });
  }

  private manager(transaction?: DatabaseTransactionContext): EntityManager {
    return transaction
      ? unwrapTypeOrmTransaction(transaction)
      : this.dataSource.manager;
  }

  private listQuery(
    cursor: { submittedAt: string; id: string } | undefined,
    limit: number,
  ) {
    const query = this.dataSource
      .getRepository(CommerceOrder)
      .createQueryBuilder('commerceOrder')
      .orderBy('commerceOrder.submittedAt', 'DESC')
      .addOrderBy('commerceOrder.id', 'DESC')
      .take(limit + 1);
    if (cursor) {
      query.andWhere(
        '(commerceOrder.submittedAt < :cursorSubmittedAt OR (commerceOrder.submittedAt = :cursorSubmittedAt AND commerceOrder.id < :cursorId))',
        {
          cursorSubmittedAt: cursor.submittedAt,
          cursorId: cursor.id,
        },
      );
    }
    return query;
  }
}
