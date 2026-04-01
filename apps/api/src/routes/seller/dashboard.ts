import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../../middleware/auth';
import { errorResponseSchema } from '../../schemas/auth.schema';
import { sellerDashboardResponseSchema } from '../../schemas/seller-dashboard.schema';
import {
  SellerDashboardServiceError,
  sellerDashboardService,
} from '../../services/seller-dashboard.service';
import {
  SellerProfileServiceError,
  sellerProfileService,
} from '../../services/seller-profile.service';

const app = new OpenAPIHono<AuthEnv>();

app.use('*', authMiddleware);
app.use('*', roleMiddleware('seller'));

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

function getStatusFromError(error: SellerDashboardServiceError | SellerProfileServiceError) {
  switch (error.code) {
    case 'SELLER_PROFILE_NOT_FOUND':
      return 404;
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
  if (error instanceof SellerDashboardServiceError || error instanceof SellerProfileServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

async function resolveSellerProfileId(userId: string, databaseUrl?: string) {
  const profile = await sellerProfileService.getProfile(userId, databaseUrl);

  return profile.id;
}

const getSellerDashboardRoute = createRoute({
  method: 'get',
  path: '/dashboard',
  tags: ['Seller Dashboard'],
  summary: 'Get seller dashboard data',
  responses: {
    200: {
      description: 'Seller dashboard retrieved successfully',
      content: {
        'application/json': {
          schema: sellerDashboardResponseSchema,
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
      description: 'Seller role required',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Seller profile not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

app.openapi(getSellerDashboardRoute, async (c) => {
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await sellerDashboardService.getDashboard(sellerProfileId, databaseUrl);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;