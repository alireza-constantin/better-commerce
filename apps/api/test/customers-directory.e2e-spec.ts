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

describe('Customer directory HTTP contract', () => {
  let app: INestApplication;
  let server: App;
  let dataSource: DataSource;
  let ownerBootstrap: OwnerBootstrapService;

  beforeAll(async () => {
    app = await createFullApplication();
    server = app.getHttpServer() as App;
    dataSource = app.get(DataSource);
    ownerBootstrap = app.get(OwnerBootstrapService);
  });

  beforeEach(async () => {
    await clearFullStackTestData(app);
    await dataSource.query('TRUNCATE TABLE customer_profiles, mobile_otp_challenges CASCADE');
  });

  afterAll(async () => app.close());

  async function csrf(agent: SuperAgentTest) {
    const response = await agent.get('/api/v1/auth/csrf').expect(200);
    return {
      token: (response.body as { csrfToken: string }).csrfToken,
      cookie: (response.headers['set-cookie']?.[0] ?? '').split(';')[0],
    };
  }

  async function ownerAgent() {
    const email = 'directory-owner@example.test';
    const registration = request.agent(server);
    const registerCsrf = await csrf(registration);
    await registration
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('Cookie', registerCsrf.cookie)
      .set('x-csrf-token', registerCsrf.token)
      .send({ email, password: PASSWORD })
      .expect(201);
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

  it('lists mobile customers with a masked mobile and supports exact search/detail', async () => {
    const customer = request.agent(server);
    const registerCsrf = await csrf(customer);
    const registration = await customer
      .post('/api/v1/auth/register/mobile')
      .set('Origin', ORIGIN)
      .set('Cookie', registerCsrf.cookie)
      .set('x-csrf-token', registerCsrf.token)
      .send({ displayName: 'فروشگاه نمونه', mobile: '09121112233' })
      .expect(201);
    const verifyCsrf = await csrf(customer);
    await customer
      .post('/api/v1/auth/register/mobile/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', verifyCsrf.cookie)
      .set('x-csrf-token', verifyCsrf.token)
      .send({ challengeId: registration.body.challengeId, code: registration.body.testCode })
      .expect(200);

    const owner = await ownerAgent();
    const list = await owner.get('/api/v1/admin/customers').expect(200);
    const found = list.body.data.find((item: { id: string }) => item.id === registration.body.userId);
    expect(found).toMatchObject({
      displayName: 'فروشگاه نمونه',
      mobile: '9891******33',
      status: 'active',
    });

    const searched = await owner
      .get('/api/v1/admin/customers')
      .query({ q: 'فروشگاه' })
      .expect(200);
    expect(searched.body.data).toHaveLength(1);

    const detail = await owner
      .get(`/api/v1/admin/customers/${registration.body.userId}`)
      .expect(200);
    expect(detail.body.displayName).toBe('فروشگاه نمونه');

    const sendCsrf = await csrf(owner);
    const message = await owner
      .post('/api/v1/admin/communications/direct-messages')
      .set('Origin', ORIGIN)
      .set('Cookie', sendCsrf.cookie)
      .set('x-csrf-token', sendCsrf.token)
      .send({
        customerId: registration.body.userId,
        body: 'سفارش شما آماده پیگیری است',
        confirmed: true,
      })
      .expect(201);
    expect(message.body).toMatchObject({ purpose: 'direct', status: 'queued' });
    await new Promise((resolve) => setTimeout(resolve, 150));
    await owner
      .get(`/api/v1/admin/communications/messages/${message.body.id}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('accepted');
      });
  });
});
