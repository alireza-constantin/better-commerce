import type { INestApplication } from '@nestjs/common';
import request, { type SuperAgentTest } from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { CatalogApplicationService } from '../src/modules/catalog/application/catalog-application.service';
import {
  clearFullStackTestData,
  createFullApplication,
} from './full-app.helper';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct horse battery staple';

describe('Cart HTTP contract', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let catalog: CatalogApplicationService;
  let server: App;

  beforeAll(async () => {
    app = await createFullApplication();
    dataSource = app.get(DataSource);
    catalog = app.get(CatalogApplicationService);
    server = app.getHttpServer() as App;
  });

  beforeEach(async () => {
    await dataSource.query(`
      TRUNCATE TABLE
        cart_claims,
        cart_lines,
        carts,
        catalog_variant_selections,
        catalog_option_values,
        catalog_product_options,
        catalog_variants,
        catalog_product_slugs,
        catalog_products
      RESTART IDENTITY CASCADE
    `);
    await clearFullStackTestData(app);
  });

  afterAll(async () => app.close());

  async function csrf(agent: SuperAgentTest): Promise<string> {
    const response = await agent.get('/api/v1/auth/csrf').expect(200);
    return (response.body as unknown as { csrfToken: string }).csrfToken;
  }

  it('persists an anonymous Cart, rejects stale writes, and claims it on login', async () => {
    const product = await catalog.createProduct({
      title: 'Cart product',
      slug: 'cart-product',
      defaultVariantTitle: 'Default',
      defaultVariantSku: 'CART-1',
      fulfillmentClassification: 'physical',
    });
    await catalog.publish(product.productId, product.version);

    const customer = request.agent(server);
    const anonymousCsrf = await csrf(customer);
    const created = await customer
      .put('/api/v1/cart/lines')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', anonymousCsrf)
      .send({
        expectedVersion: 0,
        variantId: product.variantId,
        quantity: 2,
      })
      .expect(200);
    const setCookie = created.headers['set-cookie'] as string[] | undefined;
    expect(setCookie?.join(';')).toContain('bc.cart=');
    expect(created.body).toMatchObject({
      version: 1,
      lines: [
        {
          variantId: product.variantId,
          quantity: 2,
          productTitle: 'Cart product',
        },
      ],
    });

    await customer
      .put('/api/v1/cart/lines')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', anonymousCsrf)
      .send({
        expectedVersion: 0,
        variantId: product.variantId,
        quantity: 3,
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          code: 'cart.version_conflict',
          currentVersion: 1,
        });
      });

    await customer
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', anonymousCsrf)
      .send({ email: 'cart-customer@example.test', password: PASSWORD })
      .expect(201);
    const claimCsrf = await csrf(customer);
    const claimed = await customer
      .post('/api/v1/cart/claim')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', claimCsrf)
      .send({ expectedVersion: 1 })
      .expect(201);
    expect(claimed.body).toMatchObject({
      version: 2,
      lines: [{ variantId: product.variantId, quantity: 2 }],
    });

    const otherDevice = request.agent(server);
    await otherDevice.get('/api/v1/auth/csrf').expect(200);
    await otherDevice
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', await csrf(otherDevice))
      .send({ email: 'cart-customer@example.test', password: PASSWORD })
      .expect(200);
    await otherDevice
      .get('/api/v1/cart')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          version: 2,
          lines: [{ variantId: product.variantId, quantity: 2 }],
        });
      });
  });
});
