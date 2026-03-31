import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../../middleware/auth';
import {
  sellerProfileErrorResponseSchema,
  sellerProfileResponseSchema,
  updateSellerProfileSchema,
} from '../../schemas/seller-profile.schema';
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

function getStatusFromError(error: SellerProfileServiceError) {
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
  if (error instanceof SellerProfileServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const getSellerProfileRoute = createRoute({
  method: 'get',
  path: '/profile',
  tags: ['Seller Profile'],
  summary: 'Get current seller profile',
  responses: {
    200: {
      description: 'Seller profile retrieved successfully',
      content: {
        'application/json': {
          schema: sellerProfileResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: sellerProfileErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Seller role required',
      content: {
        'application/json': {
          schema: sellerProfileErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Seller profile not found',
      content: {
        'application/json': {
          schema: sellerProfileErrorResponseSchema,
        },
      },
    },
  },
});

const updateSellerProfileRoute = createRoute({
  method: 'patch',
  path: '/profile',
  tags: ['Seller Profile'],
  summary: 'Update current seller profile',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateSellerProfileSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Seller profile updated successfully',
      content: {
        'application/json': {
          schema: sellerProfileResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: sellerProfileErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Seller role required',
      content: {
        'application/json': {
          schema: sellerProfileErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Seller profile not found',
      content: {
        'application/json': {
          schema: sellerProfileErrorResponseSchema,
        },
      },
    },
  },
});

app.openapi(getSellerProfileRoute, async (c) => {
  try {
    const result = await sellerProfileService.getProfile(
      c.var.user.id,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(updateSellerProfileRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await sellerProfileService.updateProfile(
      c.var.user.id,
      body,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;