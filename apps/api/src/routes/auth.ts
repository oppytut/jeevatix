import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';

import type { AuthEnv } from '../middleware/auth';
import { createRateLimitMiddleware, getClientIp } from '../middleware/rate-limit';
import {
  authResponseSchema,
  errorResponseSchema,
  forgotPasswordResponseSchema,
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  messageResponseSchema,
  refreshSchema,
  registerSchema,
  registerSellerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../schemas/auth.schema';
import { AuthServiceError, authService } from '../services/auth.service';

const app = new OpenAPIHono<AuthEnv>();

const registerRateLimitMiddleware = createRateLimitMiddleware({
  name: 'auth-register',
  limit: 3,
  windowMs: 60_000,
  methods: ['POST'],
  keyGenerator: (c) => getClientIp(c.req.raw.headers),
});

const loginRateLimitMiddleware = createRateLimitMiddleware({
  name: 'auth-login',
  limit: 5,
  windowMs: 60_000,
  methods: ['POST'],
  keyGenerator: (c) => getClientIp(c.req.raw.headers),
});

app.use('/register', registerRateLimitMiddleware);
app.use('/register/seller', registerRateLimitMiddleware);
app.use('/login', loginRateLimitMiddleware);

app.get('/verify-email', async (c) => {
  const secret = getJwtSecret(c.env.JWT_SECRET);

  if (!secret) {
    return c.html(renderVerifyEmailPage('JWT secret is not configured.', false), 500);
  }

  const token = new URL(c.req.raw.url).searchParams.get('token') ?? '';

  if (!token) {
    return c.html(renderVerifyEmailPage('Token verifikasi email tidak ditemukan.', false), 400);
  }

  try {
    const result = await authService.verifyEmail(token, secret, getDatabaseUrl(c.env.DATABASE_URL));
    return c.html(renderVerifyEmailPage(result.message, true), 200);
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return c.html(renderVerifyEmailPage(error.message, false), getStatusFromError(error));
    }

    return c.html(renderVerifyEmailPage('Unexpected error occurred.', false), 500);
  }
});

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function getJwtSecret(envSecret?: string) {
  return envSecret || getProcessEnv('JWT_SECRET');
}

function getDatabaseUrl(envDatabaseUrl?: string) {
  return envDatabaseUrl || getProcessEnv('DATABASE_URL');
}

function getBooleanFlag(value?: string) {
  return value === '1' || value === 'true';
}

function getExecutionContext(c: Context) {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

function getAuthFlowOptions(c: Context<AuthEnv>) {
  const executionContext = getExecutionContext(c);

  return {
    apiBaseUrl: new URL(c.req.raw.url).origin,
    buyerAppUrl: c.env.BUYER_APP_URL || getProcessEnv('BUYER_APP_URL'),
    sellerAppUrl: c.env.SELLER_APP_URL || getProcessEnv('SELLER_APP_URL'),
    EMAIL_API_KEY: c.env.EMAIL_API_KEY || getProcessEnv('EMAIL_API_KEY'),
    EMAIL_FROM: c.env.EMAIL_FROM || getProcessEnv('EMAIL_FROM'),
    exposeDebugTokens: getBooleanFlag(
      c.env.AUTH_EXPOSE_DEBUG_TOKENS || getProcessEnv('AUTH_EXPOSE_DEBUG_TOKENS'),
    ),
    scheduleTask: executionContext
      ? (task: Promise<unknown>) => executionContext.waitUntil(task)
      : undefined,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderVerifyEmailPage(message: string, success: boolean) {
  const safeMessage = escapeHtml(message);
  const title = success ? 'Email verified' : 'Verification failed';
  const heading = success ? 'Email berhasil diverifikasi' : 'Verifikasi email gagal';
  const accent = success ? '#ea580c' : '#be123c';
  const accentSoft = success ? '#ffedd5' : '#ffe4e6';

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0;background:#fff7ed;color:#431407;font-family:Arial,sans-serif;">
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <section style="max-width:560px;width:100%;background:#ffffff;border:1px solid #fed7aa;border-radius:28px;padding:32px;box-shadow:0 24px 80px rgba(154,52,18,0.12);">
        <div style="display:inline-flex;padding:12px 16px;border-radius:999px;background:${accentSoft};color:${accent};font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">
          Jeevatix Auth
        </div>
        <h1 style="margin:20px 0 12px;font-size:32px;line-height:1.2;color:#431407;">${heading}</h1>
        <p style="margin:0;font-size:16px;line-height:1.7;color:#7c2d12;">${safeMessage}</p>
        <p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#9a3412;">Anda bisa menutup halaman ini dan kembali ke aplikasi Jeevatix.</p>
      </section>
    </main>
  </body>
</html>`;
}

function jsonError(code: string, message: string) {
  return {
    success: false as const,
    error: {
      code,
      message,
    },
  };
}

function getStatusFromError(error: AuthServiceError) {
  switch (error.code) {
    case 'EMAIL_ALREADY_EXISTS':
      return 409;
    case 'INVALID_CREDENTIALS':
    case 'INVALID_REFRESH_TOKEN':
    case 'INVALID_RESET_TOKEN':
    case 'INVALID_VERIFY_EMAIL_TOKEN':
      return 401;
    case 'ACCOUNT_NOT_ACTIVE':
      return 403;
    case 'DATABASE_UNAVAILABLE':
      return 500;
    default:
      return 400;
  }
}

function handleError(c: Context, error: unknown) {
  if (error instanceof AuthServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  tags: ['Auth'],
  summary: 'Register a buyer account',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registerSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Buyer registered successfully',
      content: {
        'application/json': {
          schema: authResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid registration request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: 'Account cannot be registered in its current state',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    409: {
      description: 'Email already exists',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server configuration or database error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    429: {
      description: 'Too many registration attempts',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const registerSellerRoute = createRoute({
  method: 'post',
  path: '/register/seller',
  tags: ['Auth'],
  summary: 'Register a seller account',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: registerSellerSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Seller registered successfully',
      content: {
        'application/json': {
          schema: authResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid seller registration request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: 'Account cannot be registered in its current state',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    409: {
      description: 'Email already exists',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server configuration or database error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    429: {
      description: 'Too many registration attempts',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  summary: 'Login with email and password',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: loginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: authResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid login request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: 'Account is not active',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server configuration or database error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    429: {
      description: 'Too many login attempts',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  tags: ['Auth'],
  summary: 'Rotate access and refresh tokens',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: refreshSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Tokens rotated successfully',
      content: {
        'application/json': {
          schema: authResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid refresh request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid refresh token',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: 'Account is not active',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server configuration or database error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const forgotPasswordRoute = createRoute({
  method: 'post',
  path: '/forgot-password',
  tags: ['Auth'],
  summary: 'Generate password reset instructions and trigger email delivery',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: forgotPasswordSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Reset instructions generated',
      content: {
        'application/json': {
          schema: forgotPasswordResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid forgot password request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server configuration or database error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const resetPasswordRoute = createRoute({
  method: 'post',
  path: '/reset-password',
  tags: ['Auth'],
  summary: 'Reset account password with a valid reset token',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: resetPasswordSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Password reset successful',
      content: {
        'application/json': {
          schema: messageResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid reset password request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid reset token',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server configuration or database error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const verifyEmailRoute = createRoute({
  method: 'post',
  path: '/verify-email',
  tags: ['Auth'],
  summary: 'Verify email address with a valid token',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: verifyEmailSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Email verified successfully',
      content: {
        'application/json': {
          schema: messageResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid email verification request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid verification token',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server configuration or database error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  tags: ['Auth'],
  summary: 'Revoke the current refresh token',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: logoutSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Logout successful',
      content: {
        'application/json': {
          schema: messageResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid logout request',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid refresh token',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Server configuration or database error',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

app.openapi(registerRoute, async (c) => {
  try {
    const secret = getJwtSecret(c.env.JWT_SECRET);

    if (!secret) {
      return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
    }

    const body = c.req.valid('json');
    const result = await authService.register(
      body,
      secret,
      getDatabaseUrl(c.env.DATABASE_URL),
      getAuthFlowOptions(c),
    );
    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(registerSellerRoute, async (c) => {
  try {
    const secret = getJwtSecret(c.env.JWT_SECRET);

    if (!secret) {
      return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
    }

    const body = c.req.valid('json');
    const result = await authService.registerSeller(
      body,
      secret,
      getDatabaseUrl(c.env.DATABASE_URL),
      getAuthFlowOptions(c),
    );
    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(loginRoute, async (c) => {
  try {
    const secret = getJwtSecret(c.env.JWT_SECRET);

    if (!secret) {
      return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
    }

    const body = c.req.valid('json');
    const result = await authService.login(body, secret, getDatabaseUrl(c.env.DATABASE_URL));
    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(refreshRoute, async (c) => {
  try {
    const secret = getJwtSecret(c.env.JWT_SECRET);

    if (!secret) {
      return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
    }

    const body = c.req.valid('json');
    const result = await authService.refresh(body, secret, getDatabaseUrl(c.env.DATABASE_URL));
    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(forgotPasswordRoute, async (c) => {
  try {
    const secret = getJwtSecret(c.env.JWT_SECRET);

    if (!secret) {
      return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
    }

    const body = c.req.valid('json');
    const result = await authService.forgotPassword(
      body,
      secret,
      getDatabaseUrl(c.env.DATABASE_URL),
      getAuthFlowOptions(c),
    );
    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(resetPasswordRoute, async (c) => {
  try {
    const secret = getJwtSecret(c.env.JWT_SECRET);

    if (!secret) {
      return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
    }

    const body = c.req.valid('json');
    const result = await authService.resetPassword(
      body,
      secret,
      getDatabaseUrl(c.env.DATABASE_URL),
    );
    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(verifyEmailRoute, async (c) => {
  try {
    const secret = getJwtSecret(c.env.JWT_SECRET);

    if (!secret) {
      return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
    }

    const body = c.req.valid('json');
    const result = await authService.verifyEmail(
      body.token,
      secret,
      getDatabaseUrl(c.env.DATABASE_URL),
    );
    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(logoutRoute, async (c) => {
  try {
    const secret = getJwtSecret(c.env.JWT_SECRET);

    if (!secret) {
      return c.json(jsonError('JWT_SECRET_MISSING', 'JWT secret is not configured.'), 500);
    }

    const body = c.req.valid('json');
    const result = await authService.logout(
      body.refresh_token,
      secret,
      getDatabaseUrl(c.env.DATABASE_URL),
    );
    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

export default app;
