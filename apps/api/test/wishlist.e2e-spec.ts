import type { INestApplication } from '@nestjs/common';
import request, { type SuperAgentTest } from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  CatalogProduct,
  CatalogVariant,
  ProductLifecycleStatus,
  VariantFulfillmentClassification,
  VariantLifecycleStatus,
} from '../src/modules/catalog/persistence';
import {
  clearFullStackTestData,
  createFullApplication,
} from './full-app.helper';

const ORIGIN = 'http://localhost:3000';

describe('Customer wishlist HTTP contract', () => {
  let app: INestApplication;
  let server: App;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createFullApplication();
    server = app.getHttpServer() as App;
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await clearFullStackTestData(app);
    await dataSource.query(
      'TRUNCATE TABLE wishlist_items, customer_profiles, mobile_otp_challenges, catalog_variants, catalog_products CASCADE',
    );
  });

  afterAll(async () => app.close());

  async function csrf(agent: SuperAgentTest) {
    const response = await agent.get('/api/v1/auth/csrf').expect(200);
    return {
      token: (response.body as { csrfToken: string }).csrfToken,
      cookie: (response.headers['set-cookie']?.[0] ?? '').split(';')[0],
    };
  }

  it('adds, lists, and removes a variant while retaining unavailable variants', async () => {
    const customer = request.agent(server);
    const registerCsrf = await csrf(customer);
    const registration = await customer
      .post('/api/v1/auth/register/mobile')
      .set('Origin', ORIGIN)
      .set('Cookie', registerCsrf.cookie)
      .set('x-csrf-token', registerCsrf.token)
      .send({ displayName: 'علاقه‌مند', mobile: '09123334455' })
      .expect(201);
    const verifyCsrf = await csrf(customer);
    await customer
      .post('/api/v1/auth/register/mobile/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', verifyCsrf.cookie)
      .set('x-csrf-token', verifyCsrf.token)
      .send({ challengeId: registration.body.challengeId, code: registration.body.testCode })
      .expect(200);

    const product = await dataSource.getRepository(CatalogProduct).save({
      version: 1,
      status: ProductLifecycleStatus.ARCHIVED,
      title: 'محصول بایگانی',
      summary: null,
      description: null,
      slug: 'wishlist-archived-product',
      everPublished: true,
      publishedAt: new Date(),
      archivedAt: new Date(),
    });
    const variant = await dataSource.getRepository(CatalogVariant).save({
      productId: product.id,
      status: VariantLifecycleStatus.ARCHIVED,
      title: 'گزینه قدیمی',
      sku: null,
      normalizedSku: null,
      fulfillmentClassification: VariantFulfillmentClassification.PHYSICAL,
      position: 0,
      combinationKey: '',
    });

    const addCsrf = await csrf(customer);
    await customer
      .post('/api/v1/customer/wishlist/items')
      .set('Origin', ORIGIN)
      .set('Cookie', addCsrf.cookie)
      .set('x-csrf-token', addCsrf.token)
      .send({ variantId: variant.id })
      .expect(201);
    const list = await customer.get('/api/v1/customer/wishlist').expect(200);
    expect(list.body).toMatchObject({ count: 1 });
    expect(list.body.data[0].variantId).toBe(variant.id);

    const removeCsrf = await csrf(customer);
    await customer
      .delete(`/api/v1/customer/wishlist/items/${variant.id}`)
      .set('Origin', ORIGIN)
      .set('Cookie', removeCsrf.cookie)
      .set('x-csrf-token', removeCsrf.token)
      .expect(204);
    await customer.get('/api/v1/customer/wishlist').expect(200).expect({ data: [], count: 0 });
  });
});
