import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';

import { authMiddleware, type AuthEnv } from '../middleware/auth';
import {
  changePasswordSchema,
  updateProfileSchema,
  userErrorResponseSchema,
  userMessageResponseSchema,
  userProfileResponseSchema,
} from '../schemas/user.schema';
import { UserServiceError, userService } from '../services/user.service';

const app = new OpenAPIHono<AuthEnv>();

app.use('*', authMiddleware);

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function getDatabaseUrl(envDatabaseUrl?: string) {
  return envDatabaseUrl || getProcessEnv('DATABASE_URL');
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

function getStatusFromError(error: UserServiceError) {
  switch (error.code) {
    case 'INVALID_CREDENTIALS':
      return 401;
    case 'USER_NOT_FOUND':
      return 404;
    case 'DATABASE_UNAVAILABLE':
      return 500;
    default:
      return 400;
  }
}

function handleError(c: Context, error: unknown) {
  if (error instanceof UserServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const getMeRoute = createRoute({
  method: 'get',
  path: '/me',
  tags: ['User'],
  summary: 'Get current user profile',
  responses: {
    200: {
      description: 'Current user profile retrieved successfully',
      content: {
        'application/json': {
          schema: userProfileResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: userErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: userErrorResponseSchema,
        },
      },
    },
  },
});

const updateProfileRoute = createRoute({
  method: 'patch',
  path: '/me',
  tags: ['User'],
  summary: 'Update current user profile',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateProfileSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Profile updated successfully',
      content: {
        'application/json': {
          schema: userProfileResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: userErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: userErrorResponseSchema,
        },
      },
    },
  },
});

const changePasswordRoute = createRoute({
  method: 'patch',
  path: '/me/password',
  tags: ['User'],
  summary: 'Change current user password',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: changePasswordSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Password changed successfully',
      content: {
        'application/json': {
          schema: userMessageResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required or current password is invalid',
      content: {
        'application/json': {
          schema: userErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: userErrorResponseSchema,
        },
      },
    },
  },
});

app.openapi(getMeRoute, async (c) => {
  try {
    const result = await userService.getMe(c.var.user.id, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(updateProfileRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await userService.updateProfile(
      c.var.user.id,
      body,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(changePasswordRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await userService.changePassword(
      c.var.user.id,
      body,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

export default app;
