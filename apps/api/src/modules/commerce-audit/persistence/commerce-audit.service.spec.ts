import { CommerceAuditService } from './commerce-audit.service';

describe('CommerceAuditService', () => {
  it('filters a product activity page using the variant database column name', async () => {
    const select = jest.fn().mockReturnThis();
    const where = jest.fn().mockReturnValue({ getQuery: () => 'variant_ids' });
    const query = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      subQuery: jest.fn().mockReturnValue({
        select,
        from: jest.fn().mockReturnThis(),
        where,
        getQuery: () => 'variant_ids',
      }),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const service = new CommerceAuditService({
      getRepository: () => ({ createQueryBuilder: () => query }),
    } as never);

    await service.list({
      limit: 50,
      productId: 'ee0f75bf-bd9f-4866-ab22-a020a95d675b',
    });

    expect(where).toHaveBeenCalledWith('variant.product_id = :productId');
    expect(select).toHaveBeenCalledWith('variant.id::text');
    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('event.target_type'),
      expect.objectContaining({
        productId: 'ee0f75bf-bd9f-4866-ab22-a020a95d675b',
      }),
    );
  });

  it('uses the database timestamp column for cursor pagination', async () => {
    const query = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const cursor = Buffer.from(
      JSON.stringify({
        createdAt: '2026-08-13T12:00:00.000Z',
        id: 'ee0f75bf-bd9f-4866-ab22-a020a95d675b',
      }),
    ).toString('base64url');
    const service = new CommerceAuditService({
      getRepository: () => ({ createQueryBuilder: () => query }),
    } as never);

    await service.list({ cursor, limit: 50 });

    expect(query.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('event.created_at'),
      expect.any(Object),
    );
  });
});
