import type { INestApplication } from '@nestjs/common';
import request, { type SuperAgentTest } from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { OwnerBootstrapService } from '../src/modules/authorization/bootstrap/owner-bootstrap.service';
import {
  clearFullStackTestData,
  createFullApplication,
} from './full-app.helper';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct horse battery staple';

describe('Customer Communications HTTP contract', () => {
  let app: INestApplication;
  let server: App;
  let ownerBootstrap: OwnerBootstrapService;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createFullApplication();
    server = app.getHttpServer() as App;
    ownerBootstrap = app.get(OwnerBootstrapService);
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await clearFullStackTestData(app);
    await dataSource.query(
      'TRUNCATE TABLE message_delivery_attempts, message_intents, message_provider_routes CASCADE',
    );
    await dataSource.query('TRUNCATE TABLE communication_templates CASCADE');
    await dataSource.query('TRUNCATE TABLE communication_campaigns CASCADE');
  });

  afterAll(async () => app.close());

  async function csrf(agent: SuperAgentTest): Promise<{ token: string; cookie: string }> {
    const response = await agent.get('/api/v1/auth/csrf').expect(200);
    return {
      token: (response.body as { csrfToken: string }).csrfToken,
      cookie: (response.headers['set-cookie']?.[0] ?? '').split(';')[0],
    };
  }

  async function ownerAgent(): Promise<SuperAgentTest> {
    const email = `communications-owner-${Date.now()}@example.test`;
    const registration = request.agent(server);
    const registrationCsrf = await csrf(registration);
    const registrationResponse = await registration
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('Cookie', registrationCsrf.cookie)
      .set('x-csrf-token', registrationCsrf.token)
      .send({ email, password: PASSWORD });
    if (registrationResponse.status !== 201) {
      throw new Error(`registration failed: ${registrationResponse.status} ${JSON.stringify(registrationResponse.body)}`);
    }
    await ownerBootstrap.bootstrap(email);
    const owner = request.agent(server);
    const loginCsrf = await csrf(owner);
    await owner
      .post('/api/v1/auth/login')
      .set('Origin', ORIGIN)
      .set('Cookie', loginCsrf.cookie)
      .set('x-csrf-token', loginCsrf.token)
      .send({ email, password: PASSWORD })
      .expect(200);
    return owner;
  }

  it('queues a test Message intent and exposes normalized delivery history', async () => {
    const owner = await ownerAgent();
    const create = await owner
      .post('/api/v1/admin/communications/test-messages')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', (await csrf(owner)).token)
      .send({ body: 'پیام آزمایشی فروشگاه' })
      .expect(201);

    expect(create.body).toMatchObject({
      purpose: 'test',
      status: 'queued',
    });
    expect(create.body.destination).toBe('[masked]');

    const messageId = create.body.id as string;
    let history: { status: string; attempts: unknown[] } | undefined;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      history = (
        await owner
          .get(`/api/v1/admin/communications/messages/${messageId}`)
          .expect(200)
      ).body as typeof history;
      if (history.status === 'accepted') break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(history?.status).toBe('accepted');

    expect(history?.attempts).toEqual([
      expect.objectContaining({ status: 'accepted', attemptNumber: 1 }),
    ]);
    expect(JSON.stringify(history)).not.toContain('پیام آزمایشی');
  });

  it('exposes purpose routes and lets an authorized operator switch a configured provider', async () => {
    const owner = await ownerAgent();
    const routes = await owner
      .get('/api/v1/admin/communications/routes')
      .expect(200);
    expect(routes.body).toEqual([]);

    const configured = await owner
      .put('/api/v1/admin/communications/routes/test')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', (await csrf(owner)).token)
      .send({ providerKey: 'deterministic', enabled: true })
      .expect(200);
    expect(configured.body).toEqual({
      purpose: 'test',
      providerKey: 'deterministic',
      enabled: true,
    });
  });

  it('creates immutable versioned templates and lists every version', async () => {
    const owner = await ownerAgent();
    const firstCsrf = await csrf(owner);
    const first = await owner
      .post('/api/v1/admin/communications/templates')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', firstCsrf.token)
      .send({ key: 'order.accepted', purpose: 'transactional', body: 'Order accepted {{orderNumber}}' })
      .expect(201);
    expect(first.body.version).toBe(1);
    const secondCsrf = await csrf(owner);
    const second = await owner
      .post('/api/v1/admin/communications/templates')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', secondCsrf.token)
      .send({ key: 'order.accepted', purpose: 'transactional', body: 'Your order {{orderNumber}} was accepted.' })
      .expect(201);
    expect(second.body.version).toBe(2);
    const listed = await owner.get('/api/v1/admin/communications/templates').expect(200);
    expect(listed.body).toHaveLength(2);
    expect(listed.body.map((template: { version: number }) => template.version)).toEqual([2, 1]);
  });

  it('creates a campaign draft and freezes it on confirmation', async () => {
    const owner = await ownerAgent();
    const createCsrf = await csrf(owner);
    const created = await owner
      .post('/api/v1/admin/communications/campaigns')
      .set('Origin', ORIGIN)
      .set('x-csrf-token', createCsrf.token)
      .send({ name: 'اعلام تابستانی', audienceType: 'all_messageable', body: 'پیشنهاد جدید فروشگاه' })
      .expect(201);
    expect(created.body.status).toBe('draft');
    const confirmCsrf = await csrf(owner);
    const confirmed = await owner
      .post(`/api/v1/admin/communications/campaigns/${created.body.id}/confirm`)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', confirmCsrf.token)
      .expect(201);
    expect(confirmed.body).toMatchObject({ status: 'scheduled', frozenProviderKey: 'deterministic' });
    const dispatchCsrf = await csrf(owner);
    const dispatched = await owner
      .post(`/api/v1/admin/communications/campaigns/${created.body.id}/dispatch`)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', dispatchCsrf.token)
      .expect(201);
    expect(dispatched.body).toMatchObject({ campaignId: created.body.id, status: 'completed' });
    await owner
      .get(`/api/v1/admin/communications/campaigns/${created.body.id}/deliveries`)
      .expect(200)
      .expect([]);
    await owner
      .get(`/api/v1/admin/communications/campaigns/${created.body.id}/export`)
      .expect(200)
      .expect('user_id,status,message_intent_id');
  });
});
