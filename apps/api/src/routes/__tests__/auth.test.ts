import { getDb, schema } from '@jeevatix/core';
import { OpenAPIHono } from '@hono/zod-openapi';
import { inArray, like } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import app from '../../index';
import { authMiddleware, roleMiddleware, type AuthEnv } from '../../middleware/auth';

const globalScope = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const processEnv = (globalScope.process ??= { env: {} }).env ?? {};

processEnv.DATABASE_URL ??= 'postgresql://jeevatix:jeevatix@localhost:5432/jeevatix';
processEnv.JWT_SECRET ??= 'vitest-auth-secret';

const databaseUrl = processEnv.DATABASE_URL;
const jwtSecret = processEnv.JWT_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required for auth tests.');
}

if (!jwtSecret) {
  throw new Error('JWT_SECRET is required for auth tests.');
}

const database = getDb(databaseUrl);

if (!database) {
  throw new Error('Failed to create database connection for auth tests.');
}

const { refreshTokens, users } = schema;
const TEST_EMAIL_PREFIX = 'vitest-auth-';

const adminApp = new OpenAPIHono<AuthEnv>();
adminApp.use('*', authMiddleware);
adminApp.use('*', roleMiddleware('admin'));
adminApp.get('/admin-only', (c) => c.json({ success: true, data: { message: 'ok' } }));

type JsonRequestOptions = {
  method?: string;
  token?: string;
  body?: Record<string, unknown>;
};

type RegisterResult = {
  email: string;
  password: string;
  response: Response;
};

function createTestEmail() {
  return `${TEST_EMAIL_PREFIX}${crypto.randomUUID()}@example.com`;
}

async function requestJson(
  target: typeof app | typeof adminApp,
  path: string,
  options: JsonRequestOptions = {},
) {
  const headers = new Headers();

  if (options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  return target.request(
    path,
    {
      method: options.method ?? 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
    {
      JWT_SECRET: jwtSecret,
      DATABASE_URL: databaseUrl,
    },
  );
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

async function registerBuyer(
  overrides: Partial<Record<'email' | 'password' | 'full_name' | 'phone', string>> = {},
): Promise<RegisterResult> {
  const email = overrides.email ?? createTestEmail();
  const password = overrides.password ?? 'BuyerPass123!';

  const response = await requestJson(app, '/auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      full_name: overrides.full_name ?? 'Vitest Buyer',
      phone: overrides.phone ?? '081234567890',
    },
  });

  return {
    email,
    password,
    response,
  };
}

async function cleanupTestUsers() {
  const testUsers = await database
    .select({ id: users.id })
    .from(users)
    .where(like(users.email, `${TEST_EMAIL_PREFIX}%`));

  if (testUsers.length === 0) {
    return;
  }

  const userIds = testUsers.map((user) => user.id);

  await database.delete(refreshTokens).where(inArray(refreshTokens.userId, userIds));
  await database.delete(users).where(inArray(users.id, userIds));
}

describe.sequential('Auth API', () => {
  beforeAll(async () => {
    await cleanupTestUsers();
  });

  afterEach(async () => {
    await cleanupTestUsers();
  });

  afterAll(async () => {
    await cleanupTestUsers();
  });

  it('registers a buyer and returns access and refresh tokens', async () => {
    const { response } = await registerBuyer();
    const payload = await readJson<{
      success: boolean;
      data: { access_token: string; refresh_token: string; user: { email: string; role: string } };
    }>(response);

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.access_token).toBeTruthy();
    expect(payload.data.refresh_token).toBeTruthy();
    expect(payload.data.user.role).toBe('buyer');
  });

  it('rejects duplicate buyer registration', async () => {
    const email = createTestEmail();

    const firstAttempt = await registerBuyer({ email });
    const secondAttempt = await registerBuyer({ email });
    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(secondAttempt.response);

    expect(firstAttempt.response.status).toBe(201);
    expect(secondAttempt.response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('logs in with valid credentials', async () => {
    const { email, password } = await registerBuyer();

    const response = await requestJson(app, '/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    const payload = await readJson<{
      success: boolean;
      data: { access_token: string; refresh_token: string; user: { email: string } };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.access_token).toBeTruthy();
    expect(payload.data.refresh_token).toBeTruthy();
    expect(payload.data.user.email).toBe(email);
  });

  it('rejects login with an invalid password', async () => {
    const { email } = await registerBuyer();

    const response = await requestJson(app, '/auth/login', {
      method: 'POST',
      body: { email, password: 'WrongPassword123!' },
    });

    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns the current user for a valid access token', async () => {
    const { response: registerResponse } = await registerBuyer();
    const registerPayload = await readJson<{
      data: { access_token: string; user: { email: string } };
    }>(registerResponse);

    const response = await requestJson(app, '/users/me', {
      token: registerPayload.data.access_token,
    });

    const payload = await readJson<{
      success: boolean;
      data: { email: string };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.email).toBe(registerPayload.data.user.email);
  });

  it('rejects GET /users/me without an access token', async () => {
    const response = await requestJson(app, '/users/me');
    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('UNAUTHORIZED');
  });

  it('updates the current user profile', async () => {
    const { response: registerResponse } = await registerBuyer();
    const registerPayload = await readJson<{
      data: { access_token: string };
    }>(registerResponse);

    const response = await requestJson(app, '/users/me', {
      method: 'PATCH',
      token: registerPayload.data.access_token,
      body: { full_name: 'Updated Vitest Buyer' },
    });

    const payload = await readJson<{
      success: boolean;
      data: { full_name: string };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.full_name).toBe('Updated Vitest Buyer');
  });

  it('changes the current user password and allows login with the new password', async () => {
    const { email, response: registerResponse } = await registerBuyer();
    const registerPayload = await readJson<{
      data: { access_token: string };
    }>(registerResponse);

    const changePasswordResponse = await requestJson(app, '/users/me/password', {
      method: 'PATCH',
      token: registerPayload.data.access_token,
      body: {
        old_password: 'BuyerPass123!',
        new_password: 'BuyerPass456!',
      },
    });

    const changePasswordPayload = await readJson<{
      success: boolean;
      data: { message: string };
    }>(changePasswordResponse);

    const loginResponse = await requestJson(app, '/auth/login', {
      method: 'POST',
      body: { email, password: 'BuyerPass456!' },
    });

    const loginPayload = await readJson<{
      success: boolean;
      data: { access_token: string };
    }>(loginResponse);

    expect(changePasswordResponse.status).toBe(200);
    expect(changePasswordPayload.success).toBe(true);
    expect(changePasswordPayload.data.message).toBe('Password changed successfully.');
    expect(loginResponse.status).toBe(200);
    expect(loginPayload.success).toBe(true);
    expect(loginPayload.data.access_token).toBeTruthy();
  });

  it('rotates tokens with a valid refresh token', async () => {
    const { response: registerResponse } = await registerBuyer();
    const registerPayload = await readJson<{
      data: { access_token: string; refresh_token: string };
    }>(registerResponse);

    const response = await requestJson(app, '/auth/refresh', {
      method: 'POST',
      body: { refresh_token: registerPayload.data.refresh_token },
    });

    const payload = await readJson<{
      success: boolean;
      data: { access_token: string; refresh_token: string };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.access_token).toBeTruthy();
    expect(payload.data.refresh_token).toBeTruthy();
    expect(payload.data.access_token).not.toBe(registerPayload.data.access_token);
    expect(payload.data.refresh_token).not.toBe(registerPayload.data.refresh_token);
  });

  it('forbids a buyer from accessing an admin-only endpoint', async () => {
    const { response: registerResponse } = await registerBuyer();
    const registerPayload = await readJson<{
      data: { access_token: string };
    }>(registerResponse);

    const response = await requestJson(adminApp, '/admin-only', {
      token: registerPayload.data.access_token,
    });

    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(403);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('FORBIDDEN');
  });
});
