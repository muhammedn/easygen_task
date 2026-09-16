import { ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ACCESS_TOKEN_COOKIE } from '../src/auth/auth-cookie.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { PASSWORD_REQUIREMENTS_MESSAGE } from '../src/common/constants/validation.js';

function getSetCookieHeader(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  if (Array.isArray(raw)) {
    return raw.join(';');
  }
  return typeof raw === 'string' ? raw : '';
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer;
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

  it('signup → signin → /auth/me with bearer and cookie', async () => {
    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email, name, password })
      .expect(201);

    expect(signupRes.body.accessToken).toBeDefined();
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

    expect(signinRes.body.accessToken).toBeDefined();
    expect(signinRes.body.user.passwordHash).toBeUndefined();

    const setCookie = getSetCookieHeader(signinRes);
    expect(setCookie).toContain(`${ACCESS_TOKEN_COOKIE}=`);
    expect(setCookie.toLowerCase()).toContain('httponly');
    expect(setCookie.toLowerCase()).toContain('samesite=strict');
    expect(setCookie.toLowerCase()).not.toContain('secure');

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${signinRes.body.accessToken}`)
      .expect(200);

    const cookieValue = setCookie
      .split(',')
      .flatMap((part) => part.split(';'))
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ACCESS_TOKEN_COOKIE}=`));

    expect(cookieValue).toBeDefined();

    const meViaCookie = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookieValue as string)
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

  it('POST /auth/logout clears the auth cookie', async () => {
    const signinRes = await request(app.getHttpServer())
      .post('/auth/signin')
      .send({ email, password })
      .expect(200);

    const logoutRes = await request(app.getHttpServer())
      .post('/auth/logout')
      .expect(204);

    const cleared = getSetCookieHeader(logoutRes);
    expect(cleared).toContain(`${ACCESS_TOKEN_COOKIE}=`);
    expect(cleared.toLowerCase()).toMatch(/max-age=0|expires=/i);

    // Cookie was cleared in the response; body token from earlier signin still works
    // as a bearer (stateless JWT), which is expected.
    expect(signinRes.body.accessToken).toBeDefined();
  });
});
