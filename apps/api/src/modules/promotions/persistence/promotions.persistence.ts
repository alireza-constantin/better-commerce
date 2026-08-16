import type { DataSource, EntityManager } from 'typeorm';
import type { DatabaseTransactionContext } from '../../../platform/database';
import { unwrapTypeOrmTransaction } from '../../../platform/database/typeorm-transaction-context';

/** Keeps ORM transaction unwrapping inside the Promotions persistence boundary. */
export function promotionManager(
  dataSource: DataSource,
  transaction?: DatabaseTransactionContext,
): EntityManager {
  return transaction ? unwrapTypeOrmTransaction(transaction) : dataSource.manager;
}
