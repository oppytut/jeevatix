import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, type AuthEnv } from '../middleware/auth';
import {
  authResponseSchema,
  errorResponseSchema,
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

function handleError(
  c: Parameters<typeof app.openapi>[1] extends (arg: infer T) => unknown ? T : never,
  error: unknown,
) {
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
    409: {
      description: 'Email already exists',
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
    409: {
      description: 'Email already exists',
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
    401: {
      description: 'Invalid credentials',
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
    401: {
      description: 'Invalid refresh token',
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
  summary: 'Generate a password reset token and queue email delivery',
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
          schema: messageResponseSchema,
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
    401: {
      description: 'Invalid reset token',
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
    401: {
      description: 'Invalid verification token',
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
    401: {
      description: 'Invalid refresh token',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

app.use('/logout', authMiddleware);

app.openapi(registerRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await authService.register(body, c.env.JWT_SECRET);
    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(registerSellerRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await authService.registerSeller(body, c.env.JWT_SECRET);
    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(loginRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await authService.login(body, c.env.JWT_SECRET);
    return c.json({ success: true, data: result });
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(refreshRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await authService.refresh(body, c.env.JWT_SECRET);
    return c.json({ success: true, data: result });
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(forgotPasswordRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await authService.forgotPassword(body, c.env.JWT_SECRET);
    return c.json({ success: true, data: result });
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(resetPasswordRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await authService.resetPassword(body, c.env.JWT_SECRET);
    return c.json({ success: true, data: result });
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(verifyEmailRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await authService.verifyEmail(body.token, c.env.JWT_SECRET);
    return c.json({ success: true, data: result });
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(logoutRoute, async (c) => {
  try {
    const body = c.req.valid('json');
    const result = await authService.logout(body.refresh_token, c.env.JWT_SECRET);
    return c.json({ success: true, data: result });
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
