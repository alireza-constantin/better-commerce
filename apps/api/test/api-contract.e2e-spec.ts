import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { createFullApplication } from './full-app.helper';

const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
] as const;

interface ContractResponse {
  readonly content?: Record<string, unknown>;
  readonly headers?: Record<string, unknown>;
  readonly $ref?: string;
}

interface ContractOperation {
  readonly operationId?: string;
  readonly responses: Record<string, ContractResponse>;
}

type ContractPathItem = Partial<
  Record<(typeof HTTP_METHODS)[number], ContractOperation>
>;

describe('External API contract', () => {
  let app: INestApplication;
  let server: App;
  let document: OpenAPIObject;

  beforeAll(async () => {
    app = await createFullApplication();
    server = app.getHttpServer() as App;
    document = (await request(server).get('/docs/openapi.json').expect(200))
      .body as OpenAPIObject;
  });

  afterAll(async () => app.close());

  it('uses unique stable operation IDs and uniform transport guarantees', () => {
    const operationIds = new Set<string>();
    for (const pathItem of Object.values(document.paths)) {
      if (!pathItem) continue;
      for (const method of HTTP_METHODS) {
        const operation = (pathItem as unknown as ContractPathItem)[method];
        if (!operation) continue;
        expect(typeof operation.operationId).toBe('string');
        const operationId = operation.operationId;
        if (!operationId) throw new Error('Operation ID is missing');
        expect(operationIds.has(operationId)).toBe(false);
        operationIds.add(operationId);
        expect(operation.responses.default).toMatchObject({
          content: {
            'application/problem+json': {
              schema: {
                $ref: '#/components/schemas/ProblemDetailsDto',
              },
            },
          },
        });
        for (const response of Object.values(operation.responses)) {
          if (response.$ref) continue;
          expect(response.headers).toHaveProperty('x-request-id');
        }
      }
    }
    expect(operationIds.size).toBeGreaterThan(30);
  });

  it('publishes typed catalog, commerce, pagination, and error schemas', () => {
    const schemas = document.components?.schemas;
    for (const schemaName of [
      'ProblemDetailsDto',
      'ProductDetailResponseDto',
      'PublicProductPageResponseDto',
      'OrderResponseDto',
      'OrdersPageResponseDto',
      'CommerceAuditPageResponseDto',
      'ShippingConfigurationResponseDto',
    ]) {
      expect(schemas).toHaveProperty(schemaName);
    }
    expect(
      document.paths['/api/v1/orders']?.get?.responses['200'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/OrdersPageResponseDto',
          },
        },
      },
    });
    const ordersParameters =
      document.paths['/api/v1/orders']?.get?.parameters ?? [];
    const ordersLimitParameter = ordersParameters.find(
      (parameter) => 'name' in parameter && parameter.name === 'limit',
    );
    expect(ordersLimitParameter).toBeDefined();
    if (!ordersLimitParameter || !('name' in ordersLimitParameter)) {
      throw new Error('Orders limit query parameter is missing');
    }
    expect(ordersLimitParameter).toMatchObject({
      in: 'query',
      schema: {
        type: 'number',
      },
    });
    expect(document.paths['/api/v1/checkout/orders']?.post?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: 'header',
          name: 'Idempotency-Key',
          required: true,
        }),
      ]),
    );
    expect(
      document.paths['/api/v1/admin/promotions/{promotionId}/redemptions']?.get
        ?.responses['200'],
    ).toMatchObject({
      content: {
        'application/json': {
          schema: {
            $ref: '#/components/schemas/PromotionRedemptionPageResponseDto',
          },
        },
      },
    });
  });
});
