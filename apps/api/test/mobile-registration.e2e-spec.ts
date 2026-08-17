import type { INestApplication } from '@nestjs/common';
import request, { type SuperAgentTest } from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  CustomerProfile,
  CustomerProfileStatus,
} from '../src/modules/customers/customer-profile.entity';
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

  it('supports mobile OTP login for an activated customer', async () => {
    const registrationAgent = request.agent(server);
    const registrationCsrf = await csrf(registrationAgent);
    const registration = await registrationAgent
      .post('/api/v1/auth/register/mobile')
      .set('Origin', ORIGIN)
      .set('Cookie', registrationCsrf.cookie)
      .set('x-csrf-token', registrationCsrf.token)
      .send({ displayName: 'ورود آزمایشی', mobile: '09129876543' })
      .expect(201);
    const verificationCsrf = await csrf(registrationAgent);
    await registrationAgent
      .post('/api/v1/auth/register/mobile/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', verificationCsrf.cookie)
      .set('x-csrf-token', verificationCsrf.token)
      .send({ challengeId: registration.body.challengeId, code: registration.body.testCode })
      .expect(200);

    const loginAgent = request.agent(server);
    const loginRequestCsrf = await csrf(loginAgent);
    const loginRequest = await loginAgent
      .post('/api/v1/auth/login/mobile/request')
      .set('Origin', ORIGIN)
      .set('Cookie', loginRequestCsrf.cookie)
      .set('x-csrf-token', loginRequestCsrf.token)
      .send({ mobile: '09129876543' })
      .expect(201);
    const loginVerifyCsrf = await csrf(loginAgent);
    await loginAgent
      .post('/api/v1/auth/login/mobile/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', loginVerifyCsrf.cookie)
      .set('x-csrf-token', loginVerifyCsrf.token)
      .send({ challengeId: loginRequest.body.challengeId, code: loginRequest.body.testCode })
      .expect(200)
      .expect((response) => {
        expect(response.body.mobile).toBe('989129876543');
      });
    await loginAgent.get('/api/v1/auth/me').expect(200);
  });

  it('lets an existing email account enroll a verified mobile number', async () => {
    const agent = request.agent(server);
    const registerCsrf = await csrf(agent);
    await agent
      .post('/api/v1/auth/register')
      .set('Origin', ORIGIN)
      .set('Cookie', registerCsrf.cookie)
      .set('x-csrf-token', registerCsrf.token)
      .send({ email: 'enrollment@example.test', password: 'correct horse battery staple' })
      .expect(201);
    const enrollCsrf = await csrf(agent);
    const enrollment = await agent
      .post('/api/v1/auth/mobile/enroll/request')
      .set('Origin', ORIGIN)
      .set('Cookie', enrollCsrf.cookie)
      .set('x-csrf-token', enrollCsrf.token)
      .send({ mobile: '09121112233' })
      .expect(201);
    const verifyCsrf = await csrf(agent);
    await agent
      .post('/api/v1/auth/mobile/enroll/verify')
      .set('Origin', ORIGIN)
      .set('Cookie', verifyCsrf.cookie)
      .set('x-csrf-token', verifyCsrf.token)
      .send({ challengeId: enrollment.body.challengeId, code: enrollment.body.testCode })
      .expect(200);
    await agent.get('/api/v1/auth/me').expect(200).expect((response) => {
      expect(response.body.mobile).toBe('989121112233');
    });
  });
});
