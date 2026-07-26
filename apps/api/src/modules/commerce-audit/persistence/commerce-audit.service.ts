import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { DatabaseTransactionContext } from '../../../platform/database';
import { unwrapTypeOrmTransaction } from '../../../platform/database/typeorm-transaction-context';
import { assertCommerceAuditMetadata } from '../commerce-audit.catalogue';
import type {
  CommerceAuditContract,
  CommerceAuditWrite,
} from '../commerce-audit.contract';
import { CommerceAuditEvent } from './commerce-audit-event.entity';

@Injectable()
export class CommerceAuditService implements CommerceAuditContract {
  constructor(private readonly dataSource: DataSource) {}

  async record(
    input: CommerceAuditWrite,
    transaction: DatabaseTransactionContext,
  ): Promise<void> {
    assertCommerceAuditMetadata(input.action, input.metadata);
    const repository =
      unwrapTypeOrmTransaction(transaction).getRepository(CommerceAuditEvent);
    await repository.save(repository.create(input));
  }

  async list(input: { limit: number; cursor?: string }) {
    const cursor = this.decodeCursor(input.cursor);
    const query = this.dataSource
      .getRepository(CommerceAuditEvent)
      .createQueryBuilder('event')
      .orderBy('event.createdAt', 'DESC')
      .addOrderBy('event.id', 'DESC')
      .take(input.limit + 1);
    if (cursor) {
      query.andWhere(
        '(event.createdAt < :cursorCreatedAt OR (event.createdAt = :cursorCreatedAt AND event.id < :cursorId))',
        { cursorCreatedAt: cursor.createdAt, cursorId: cursor.id },
      );
    }
    const rows = await query.getMany();
    const page = rows.slice(0, input.limit);
    const items = page.map((event) => ({
      id: event.id,
      actorUserId: event.actorUserId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      requestId: event.requestId,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    }));
    const last = page.at(-1);
    return {
      items,
      nextCursor:
        rows.length > input.limit && last
          ? this.encodeCursor(last.createdAt, last.id)
          : null,
    };
  }

  private encodeCursor(createdAt: Date, id: string): string {
    return Buffer.from(
      JSON.stringify({ createdAt: createdAt.toISOString(), id }),
    ).toString('base64url');
  }

  private decodeCursor(
    value?: string,
  ): { createdAt: string; id: string } | undefined {
    if (!value) return undefined;
    if (value.length > 512)
      throw new BadRequestException('Invalid commerce audit cursor');
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(value, 'base64url').toString('utf8'),
      );
      const cursor = parsed as { createdAt?: unknown; id?: unknown };
      if (
        !cursor ||
        typeof cursor !== 'object' ||
        typeof cursor.createdAt !== 'string' ||
        Number.isNaN(Date.parse(cursor.createdAt)) ||
        typeof cursor.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          cursor.id,
        )
      )
        throw new Error('invalid cursor');
      return { createdAt: cursor.createdAt, id: cursor.id };
    } catch {
      throw new BadRequestException('Invalid commerce audit cursor');
    }
  }
}
