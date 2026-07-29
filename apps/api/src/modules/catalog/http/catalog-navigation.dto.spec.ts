import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ReplaceCollectionProductsDto,
  ReplaceProductCategoriesDto,
} from './catalog-navigation.dto';

const firstId = '10000000-0000-4000-8000-000000000001';
const secondId = '10000000-0000-4000-8000-000000000002';

describe('Catalog navigation DTO contract', () => {
  it('rejects duplicate Product Category IDs', async () => {
    const dto = plainToInstance(ReplaceProductCategoriesDto, {
      expectedVersion: 1,
      categoryIds: [firstId, firstId],
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('accepts unique, contiguous ordered Collection membership', async () => {
    const dto = plainToInstance(ReplaceCollectionProductsDto, {
      expectedVersion: 1,
      items: [
        { productId: firstId, position: 0 },
        { productId: secondId, position: 1 },
      ],
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects duplicate Collection Products or positions', async () => {
    const duplicateProduct = plainToInstance(ReplaceCollectionProductsDto, {
      expectedVersion: 1,
      items: [
        { productId: firstId, position: 0 },
        { productId: firstId, position: 1 },
      ],
    });
    const duplicatePosition = plainToInstance(ReplaceCollectionProductsDto, {
      expectedVersion: 1,
      items: [
        { productId: firstId, position: 0 },
        { productId: secondId, position: 0 },
      ],
    });

    expect(await validate(duplicateProduct)).not.toHaveLength(0);
    expect(await validate(duplicatePosition)).not.toHaveLength(0);
  });
});
