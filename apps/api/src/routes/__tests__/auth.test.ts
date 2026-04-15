import { getDb, schema } from '@jeevatix/core';
import { OpenAPIHono } from '@hono/zod-openapi';
import { inArray, like } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import app from '../../index';
import { authMiddleware, roleMiddleware, type AuthEnv } from '../../middleware/auth';
import { resetRateLimitState } from '../../middleware/rate-limit';

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

const databaseInstance = getDb(databaseUrl);

if (!databaseInstance) {
  throw new Error('Failed to create database connection for auth tests.');
}

const database = databaseInstance;

const { refreshTokens, sellerProfiles, users } = schema;
const TEST_EMAIL_PREFIX = 'vitest-auth-';

const adminApp = new OpenAPIHono<AuthEnv>();
adminApp.use('*', authMiddleware);
adminApp.use('*', roleMiddleware('admin'));
adminApp.get('/admin-only', (c) => c.json({ success: true, data: { message: 'ok' } }));

type JsonRequestOptions = {
  method?: string;
  token?: string;
  body?: Record<string, unknown>;
  headers?: HeadersInit;
  env?: Record<string, string | undefined>;
};

type RegisterResult = {
  email: string;
  password: string;
  response: Response;
};

function createTestEmail() {
  return `${TEST_EMAIL_PREFIX}${crypto.randomUUID()}@example.com`;
}

function createEmailApiResponse() {
  return new Response(JSON.stringify({ id: 'email_123' }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function requestJson(
  target: typeof app | typeof adminApp,
  path: string,
  options: JsonRequestOptions = {},
) {
  const headers = new Headers(options.headers);

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
      ...options.env,
    },
  );
}

async function readJson<T>(response: Response) {
  return (await response.json()) as T;
}

async function registerBuyer(
  overrides: Partial<Record<'email' | 'password' | 'full_name' | 'phone', string>> = {},
  headers?: HeadersInit,
): Promise<RegisterResult> {
  const email = overrides.email ?? createTestEmail();
  const password = overrides.password ?? 'BuyerPass123!';

  const response = await requestJson(app, '/auth/register', {
    method: 'POST',
    headers,
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

  await database.delete(sellerProfiles).where(inArray(sellerProfiles.userId, userIds));
  await database.delete(refreshTokens).where(inArray(refreshTokens.userId, userIds));
  await database.delete(users).where(inArray(users.id, userIds));
}

describe.sequential('Auth API', () => {
  beforeAll(async () => {
    await cleanupTestUsers();
  });

  afterEach(async () => {
    resetRateLimitState();
    await cleanupTestUsers();
  });

  afterAll(async () => {
    resetRateLimitState();
    await cleanupTestUsers();
  });

  it('registers a buyer and returns session tokens without exposing verification tokens', async () => {
    const { response } = await registerBuyer();
    const payload = await readJson<{
      success: boolean;
      data: {
        access_token: string;
        refresh_token: string;
        user: { email: string; role: string };
        verify_email_token?: string;
      };
    }>(response);

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.access_token).toBeTruthy();
    expect(payload.data.refresh_token).toBeTruthy();
    expect(payload.data.user.role).toBe('buyer');
    expect(payload.data.verify_email_token).toBeUndefined();
  });

  it('registers a seller and returns seller tokens without exposing verification tokens', async () => {
    const email = createTestEmail();

    const response = await requestJson(app, '/auth/register/seller', {
      method: 'POST',
      body: {
        email,
        password: 'SellerPass123!',
        full_name: 'Vitest Seller',
        phone: '081234567891',
        org_name: 'Vitest Organizer',
        org_description: 'Organizer for auth coverage tests.',
      },
    });

    const payload = await readJson<{
      success: boolean;
      data: {
        access_token: string;
        refresh_token: string;
        user: { email: string; role: string };
        verify_email_token?: string;
      };
    }>(response);

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.user.email).toBe(email);
    expect(payload.data.user.role).toBe('seller');
    expect(payload.data.access_token).toBeTruthy();
    expect(payload.data.refresh_token).toBeTruthy();
    expect(payload.data.verify_email_token).toBeUndefined();
  });

  it('sends a verification email when register email delivery is configured', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createEmailApiResponse());
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;

    try {
      const response = await requestJson(app, '/auth/register', {
        method: 'POST',
        body: {
          email: createTestEmail(),
          password: 'BuyerPass123!',
          full_name: 'Vitest Buyer Email',
          phone: '081234567890',
        },
        env: {
          EMAIL_API_KEY: 'test-email-key',
          EMAIL_FROM: 'noreply@example.com',
        },
      });

      expect(response.status).toBe(201);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({ method: 'POST' }),
      );

      const [, requestInit] = fetchMock.mock.calls[0] ?? [];
      const body = JSON.parse(String(requestInit?.body)) as {
        html: string;
        subject: string;
        to: string[];
      };

      expect(body.subject).toBe('Verifikasi email akun Jeevatix Anda');
      expect(body.html).toContain('/auth/verify-email?token=');
    } finally {
      globalThis.fetch = originalFetch;
    }
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

  it('rate limits buyer registration attempts per IP address', async () => {
    const ipAddress = '198.51.100.10';

    const attemptOne = await registerBuyer(
      { email: createTestEmail() },
      { 'CF-Connecting-IP': ipAddress },
    );
    const attemptTwo = await registerBuyer(
      { email: createTestEmail() },
      { 'CF-Connecting-IP': ipAddress },
    );
    const attemptThree = await registerBuyer(
      { email: createTestEmail() },
      { 'CF-Connecting-IP': ipAddress },
    );
    const attemptFour = await registerBuyer(
      { email: createTestEmail() },
      { 'CF-Connecting-IP': ipAddress },
    );
    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(attemptFour.response);

    expect(attemptOne.response.status).toBe(201);
    expect(attemptTwo.response.status).toBe(201);
    expect(attemptThree.response.status).toBe(201);
    expect(attemptFour.response.status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('RATE_LIMIT_EXCEEDED');
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

  it('rate limits login attempts per IP address', async () => {
    const { email } = await registerBuyer();
    const ipAddress = '198.51.100.11';
    const attempts: Response[] = [];

    for (let index = 0; index < 6; index += 1) {
      attempts.push(
        await requestJson(app, '/auth/login', {
          method: 'POST',
          headers: { 'CF-Connecting-IP': ipAddress },
          body: { email, password: 'WrongPassword123!' },
        }),
      );
    }

    const payload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(attempts[5]);

    expect(attempts.slice(0, 5).every((response) => response.status === 401)).toBe(true);
    expect(attempts[5].status).toBe(429);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('RATE_LIMIT_EXCEEDED');
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

  it('logs out and rejects reuse of the revoked refresh token', async () => {
    const { response: registerResponse } = await registerBuyer();
    const registerPayload = await readJson<{
      data: { refresh_token: string };
    }>(registerResponse);

    const logoutResponse = await requestJson(app, '/auth/logout', {
      method: 'POST',
      body: { refresh_token: registerPayload.data.refresh_token },
    });
    const logoutPayload = await readJson<{
      success: boolean;
      data: { message: string };
    }>(logoutResponse);

    const refreshResponse = await requestJson(app, '/auth/refresh', {
      method: 'POST',
      body: { refresh_token: registerPayload.data.refresh_token },
    });
    const refreshPayload = await readJson<{
      success: boolean;
      error: { code: string };
    }>(refreshResponse);

    expect(logoutResponse.status).toBe(200);
    expect(logoutPayload.success).toBe(true);
    expect(logoutPayload.data.message).toBe('Logout successful.');
    expect(refreshResponse.status).toBe(401);
    expect(refreshPayload.success).toBe(false);
    expect(refreshPayload.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('returns reset instructions without exposing reset tokens by default', async () => {
    const { email } = await registerBuyer();

    const response = await requestJson(app, '/auth/forgot-password', {
      method: 'POST',
      body: { email },
    });

    const payload = await readJson<{
      success: boolean;
      data: { message: string; reset_token?: string };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.message).toBe(
      'If the email is registered, reset instructions have been generated.',
    );
    expect(payload.data.reset_token).toBeUndefined();
  });

  it('sends a reset email when forgot-password email delivery is configured', async () => {
    const { email } = await registerBuyer();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(createEmailApiResponse());
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock;

    try {
      const response = await requestJson(app, '/auth/forgot-password', {
        method: 'POST',
        body: { email },
        env: {
          EMAIL_API_KEY: 'test-email-key',
          EMAIL_FROM: 'noreply@example.com',
          BUYER_APP_URL: 'https://buyer.example.com',
        },
      });

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledOnce();

      const [, requestInit] = fetchMock.mock.calls[0] ?? [];
      const body = JSON.parse(String(requestInit?.body)) as {
        html: string;
        subject: string;
      };

      expect(body.subject).toBe('Reset password akun Jeevatix');
      expect(body.html).toContain('https://buyer.example.com/reset-password?token=');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('exposes a reset token only when debug mode is enabled and allows password reset', async () => {
    const { email, password } = await registerBuyer();

    const forgotResponse = await requestJson(app, '/auth/forgot-password', {
      method: 'POST',
      body: { email },
      env: { AUTH_EXPOSE_DEBUG_TOKENS: '1' },
    });
    const forgotPayload = await readJson<{
      success: boolean;
      data: { message: string; reset_token?: string };
    }>(forgotResponse);

    const resetResponse = await requestJson(app, '/auth/reset-password', {
      method: 'POST',
      body: {
        token: forgotPayload.data.reset_token ?? '',
        password: 'ResetPass789#',
      },
    });
    const resetPayload = await readJson<{
      success: boolean;
      data: { message: string };
    }>(resetResponse);

    const oldLoginResponse = await requestJson(app, '/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    const newLoginResponse = await requestJson(app, '/auth/login', {
      method: 'POST',
      body: { email, password: 'ResetPass789#' },
    });

    expect(forgotResponse.status).toBe(200);
    expect(forgotPayload.success).toBe(true);
    expect(forgotPayload.data.reset_token).toBeTruthy();
    expect(resetResponse.status).toBe(200);
    expect(resetPayload.success).toBe(true);
    expect(resetPayload.data.message).toBe('Password has been reset successfully.');
    expect(oldLoginResponse.status).toBe(401);
    expect(newLoginResponse.status).toBe(200);
  });

  it('exposes a verification token only when debug mode is enabled and verifies email', async () => {
    const { response: registerResponse } = await registerBuyer();
    const registerPayload = await readJson<{
      success: boolean;
      data: { verify_email_token?: string; user: { email_verified_at: string | null } };
    }>(registerResponse);

    expect(registerPayload.data.verify_email_token).toBeUndefined();

    const debugRegisterResponse = await requestJson(app, '/auth/register', {
      method: 'POST',
      body: {
        email: createTestEmail(),
        password: 'BuyerPass123!',
        full_name: 'Vitest Buyer Debug',
        phone: '081234567890',
      },
      env: { AUTH_EXPOSE_DEBUG_TOKENS: '1' },
    });
    const debugRegisterPayload = await readJson<{
      success: boolean;
      data: { verify_email_token?: string; user: { email_verified_at: string | null } };
    }>(debugRegisterResponse);

    const verifyResponse = await requestJson(app, '/auth/verify-email', {
      method: 'POST',
      body: { token: debugRegisterPayload.data.verify_email_token ?? '' },
    });
    const verifyPayload = await readJson<{
      success: boolean;
      data: { message: string };
    }>(verifyResponse);

    expect(debugRegisterResponse.status).toBe(201);
    expect(debugRegisterPayload.data.verify_email_token).toBeTruthy();
    expect(verifyResponse.status).toBe(200);
    expect(verifyPayload.success).toBe(true);
    expect(verifyPayload.data.message).toBe('Email has been verified successfully.');
  });

  it('renders an HTML confirmation page for email verification links', async () => {
    const debugRegisterResponse = await requestJson(app, '/auth/register', {
      method: 'POST',
      body: {
        email: createTestEmail(),
        password: 'BuyerPass123!',
        full_name: 'Vitest Buyer Link',
        phone: '081234567890',
      },
      env: { AUTH_EXPOSE_DEBUG_TOKENS: '1' },
    });
    const debugRegisterPayload = await readJson<{
      success: boolean;
      data: { verify_email_token?: string };
    }>(debugRegisterResponse);

    const response = await requestJson(
      app,
      `/auth/verify-email?token=${encodeURIComponent(debugRegisterPayload.data.verify_email_token ?? '')}`,
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Email berhasil diverifikasi');
  });

  it('returns the generic forgot-password response for unknown emails', async () => {
    const response = await requestJson(app, '/auth/forgot-password', {
      method: 'POST',
      body: { email: createTestEmail() },
    });

    const payload = await readJson<{
      success: boolean;
      data: { message: string; reset_token?: string };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.message).toBe(
      'If the email is registered, reset instructions have been generated.',
    );
    expect(payload.data.reset_token).toBeUndefined();
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
