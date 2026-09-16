import { ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ACCESS_TOKEN_COOKIE } from '../src/auth/auth-cookie.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '../src/common/constants/validation.js';
import {
  User,
  type UserDocument,
} from '../src/users/schemas/user.schema.js';

function getSetCookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) {
    return raw.join(';');
  }
  return typeof raw === 'string' ? raw : '';
}

function cookieHeaderFromSetCookie(setCookie: string): string {
  const cookieValue = setCookie
    .split(',')
    .flatMap((part) => part.split(';'))
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCESS_TOKEN_COOKIE}=`));

  expect(cookieValue).toBeDefined();
  return cookieValue as string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
  let userModel: Model<UserDocument>;
  const password = 'Secret1!';
  const name = 'Test User';
  let email: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();

    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.MONGODB_URI = mongoServer.getUri();
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars!!';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    process.env.COOKIE_SECURE = 'false';
    process.env.TRUST_PROXY = 'false';

    // Nest 12 ConfigModule.forRoot validates env at import time; load AppModule only after env is set.
    const { AppModule } = await import('../src/app.module.js');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
    email = `user_${Date.now()}@example.com`;
  }, 300_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('GET /health returns ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.uptime).toBeDefined();
  });

  it('signup → signin → /auth/me with cookie only', async () => {
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, name, password })
      .expect(201);

    expect(signupRes.body.accessToken).toBeUndefined();
    expect(signupRes.body.user).toEqual(
      expect.objectContaining({ email, name }),
    );
    expect(signupRes.body.user.passwordHash).toBeUndefined();

    const signupCookie = getSetCookieHeader(signupRes);
    expect(signupCookie).toContain(`${ACCESS_TOKEN_COOKIE}=`);
    expect(signupCookie.toLowerCase()).toContain('httponly');
    expect(signupCookie.toLowerCase()).toContain('samesite=strict');
    expect(signupCookie.toLowerCase()).not.toContain('secure');

    const signinRes = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(200);

    expect(signinRes.body.accessToken).toBeUndefined();
    expect(signinRes.body.user.passwordHash).toBeUndefined();

    const setCookie = getSetCookieHeader(signinRes);
    expect(setCookie).toContain(`${ACCESS_TOKEN_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=strict');
    expect(setCookie.toLowerCase()).not.toContain('secure');

    const cookieValue = cookieHeaderFromSetCookie(setCookie);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${cookieValue.split('=')[1]}`)
      .expect(401);

    const meViaCookie = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookieValue)
      .expect(200);

    expect(meViaCookie.body.user).toEqual(
      expect.objectContaining({ email, name }),
    );
    expect(meViaCookie.body.user.passwordHash).toBeUndefined();
  });

  it('GET /auth/me without a token returns 401', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects weak password on signup', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: `weak_${Date.now()}@example.com`,
        name,
        password: 'short',
      })
      .expect(400);

    expect(Array.isArray(res.body.message)).toBe(true);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining(PASSWORD_REQUIREMENTS_MESSAGE),
      ]),
    );
  });

  it('returns 409 on duplicate signup', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, name, password })
      .expect(409);
  });

  it('POST /auth/logout without a cookie returns 401', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(401);
  });

  it('POST /auth/logout revokes the cookie session', async () => {
    const signinRes = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(200);

    const cookieValue = cookieHeaderFromSetCookie(
      getSetCookieHeader(signinRes),
    );

    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookieValue)
      .expect(204);

    const cleared = getSetCookieHeader(logoutRes);
    expect(cleared).toContain(`${ACCESS_TOKEN_COOKIE}=`);
    expect(cleared.toLowerCase()).toMatch(/max-age=0|expires=/i);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookieValue)
      .expect(401);
  });

  it('rejects short name, invalid email, overlong fields, and unknown body keys', async () => {
    const shortName = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: `short_${Date.now()}@example.com`,
        name: 'Ab',
        password,
      })
      .expect(400);
    expect(Array.isArray(shortName.body.message)).toBe(true);

    const invalidEmail = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'not-an-email',
        name,
        password,
      })
      .expect(400);
    expect(Array.isArray(invalidEmail.body.message)).toBe(true);

    const longName = 'N'.repeat(NAME_MAX_LENGTH + 1);
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: `longname_${Date.now()}@example.com`,
        name: longName,
        password,
      })
      .expect(400);

    const longPassword = `${'A'.repeat(PASSWORD_MAX_LENGTH - 1)}1!`;
    expect(longPassword.length).toBe(PASSWORD_MAX_LENGTH + 1);
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: `longpass_${Date.now()}@example.com`,
        name,
        password: longPassword,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: `extra_${Date.now()}@example.com`,
        name,
        password,
        role: 'admin',
      })
      .expect(400);
  });

  it('normalizes mixed-case email on signup and signin', async () => {
    const mixedEmail = `Jane_${Date.now()}@Example.COM`;
    const normalized = mixedEmail.toLowerCase();

    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: mixedEmail, name, password })
      .expect(201);

    expect(signupRes.body.user.email).toBe(normalized);

    const stored = await userModel.findOne({ email: normalized }).exec();
    expect(stored).not.toBeNull();
    expect(stored?.email).toBe(normalized);

    const signinRes = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: mixedEmail.toUpperCase(), password })
      .expect(200);

    expect(signinRes.body.user.email).toBe(normalized);
  });

  it('locks the account after 5 failed signins and unlocks after lockUntil', async () => {
    const lockEmail = `lock_${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: lockEmail, name, password })
      .expect(201);

    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/signin')
        .send({ email: lockEmail, password: 'Wrong1!' })
        .expect(401);
    }

    await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: lockEmail, password })
      .expect(429);

    await userModel
      .updateOne(
        { email: lockEmail },
        { $set: { lockUntil: new Date(Date.now() - 1_000) } },
      )
      .exec();

    const unlocked = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email: lockEmail, password })
      .expect(200);

    expect(unlocked.body.user.email).toBe(lockEmail);
  });
});
