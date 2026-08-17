import type { INestApplication } from '@nestjs/common';
import request, { type SuperAgentTest } from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { CustomerProfile, CustomerProfileStatus } from '../src/modules/customers';
import { MobileOtpChallenge } from '../src/modules/identity/persistence/mobile-otp-challenge.entity';
import {
  clearFullStackTestData,
  createFullApplication,
} from './full-app.helper';

const ORIGIN = 'http://localhost:3000';

describe('Mobile customer registration HTTP contract', () => {
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
      'TRUNCATE TABLE customer_profiles, mobile_otp_challenges CASCADE',
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

  it('creates a pending customer, sends an OTP, and activates the profile after verification', async () => {
    const agent = request.agent(server);
    const registrationCsrf = await csrf(agent);
    const registration = await agent
      .post('/api/v1/auth/register/mobile')
      .set('Origin', ORIGIN)
      .set('Cookie', registrationCsrf.cookie)
      .set('x-csrf-token', registrationCsrf.token)
      .send({ displayName: 'مشتری آزمایشی', mobile: '09121234567' })
      .expect(201);

    expect(registration.body).toMatchObject({
      mobile: '989121234567',
      status: 'pending',
    });
    expect(registration.body.testCode).toMatch(/^\d{6}$/);

    const verificationCsrf = await csrf(agent);
    const verified = await agent
      .post('/api/v1/auth/register/mobile/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', verificationCsrf.cookie)
      .set('x-csrf-token', verificationCsrf.token)
      .send({
        challengeId: registration.body.challengeId,
        code: registration.body.testCode,
      })
      .expect(200);

    expect(verified.body).toMatchObject({
      mobile: '989121234567',
      email: null,
      emailVerified: false,
    });
    const profile = await dataSource
      .getRepository(CustomerProfile)
      .findOneByOrFail({ userId: registration.body.userId });
    expect(profile.status).toBe(CustomerProfileStatus.ACTIVE);
    await dataSource
      .getRepository(MobileOtpChallenge)
      .findOneByOrFail({ id: registration.body.challengeId, status: 'consumed' });
  });
});
