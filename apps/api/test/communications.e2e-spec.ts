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
});
