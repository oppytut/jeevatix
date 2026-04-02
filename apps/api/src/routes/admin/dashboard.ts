import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, type AuthEnv, roleMiddleware } from '../../middleware/auth';
import { errorResponseSchema } from '../../schemas/auth.schema';
import { adminDashboardResponseSchema } from '../../schemas/admin-dashboard.schema';
import {
  AdminDashboardServiceError,
  adminDashboardService,
} from '../../services/admin-dashboard.service';

const app = new OpenAPIHono<AuthEnv>();

app.use('*', authMiddleware, roleMiddleware('admin'));

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

function handleError(
  c: Parameters<typeof app.openapi>[1] extends (arg: infer T) => unknown ? T : never,
  error: unknown,
) {
  if (error instanceof AdminDashboardServiceError) {
    return c.json(jsonError(error.code, error.message), 500);
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const getAdminDashboardRoute = createRoute({
  method: 'get',
  path: '/dashboard',
  tags: ['Admin Dashboard'],
  summary: 'Get admin dashboard data',
  responses: {
    200: {
      description: 'Admin dashboard retrieved successfully',
      content: {
        'application/json': {
          schema: adminDashboardResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: 'Admin access required',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    500: {
      description: 'Database unavailable',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

app.openapi(getAdminDashboardRoute, async (c) => {
  try {
    const result = await adminDashboardService.getDashboard(getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;