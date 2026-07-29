import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { DatabaseTransactionContext } from '../../../platform/database';
import { unwrapTypeOrmTransaction } from '../../../platform/database/typeorm-transaction-context';
import { CartLine } from '../cart-line.entity';
import { Cart, CartStatus } from '../cart.entity';

@Injectable()
export class CartPersistence {
  constructor(private readonly dataSource: DataSource) {}

  async lockActiveCustomerCart(
    userId: string,
    cartId: string,
    transaction: DatabaseTransactionContext,
  ): Promise<Cart | null> {
    return this.manager(transaction)
      .getRepository(Cart)
      .createQueryBuilder('cart')
      .setLock('pessimistic_write')
      .where('cart.id = :cartId', { cartId })
      .andWhere('cart.user_id = :userId', { userId })
      .andWhere('cart.status = :status', { status: CartStatus.ACTIVE })
      .getOne();
  }

  listLines(cartId: string, transaction: DatabaseTransactionContext) {
    return this.manager(transaction)
      .getRepository(CartLine)
      .find({
        where: { cartId },
        order: { createdAt: 'ASC', id: 'ASC' },
      });
  }

  complete(
    cartId: string,
    expectedVersion: number,
    transaction: DatabaseTransactionContext,
  ) {
    return this.manager(transaction)
      .getRepository(Cart)
      .update(
        { id: cartId, status: CartStatus.ACTIVE, version: expectedVersion },
        {
          status: CartStatus.CHECKED_OUT,
          terminalAt: new Date(),
          version: expectedVersion + 1,
        },
      );
  }

  private manager(transaction: DatabaseTransactionContext) {
    return unwrapTypeOrmTransaction(transaction);
  }
}
