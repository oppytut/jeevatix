import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../../middleware/auth';
import { errorResponseSchema } from '../../schemas/auth.schema';
import {
  listSellerOrdersQuerySchema,
  sellerOrderIdParamSchema,
  sellerOrderResponseSchema,
  sellerOrdersListResponseSchema,
} from '../../schemas/seller-order.schema';
import { SellerOrderServiceError, sellerOrderService } from '../../services/seller-order.service';
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

function getStatusFromError(error: SellerOrderServiceError | SellerProfileServiceError) {
  switch (error.code) {
    case 'FORBIDDEN':
      return 403;
    case 'ORDER_NOT_FOUND':
    case 'SELLER_PROFILE_NOT_FOUND':
      return 404;
    case 'DATABASE_UNAVAILABLE':
      return 500;
    default:
      return 400;
  }
}

function handleError(c: Context, error: unknown) {
  if (error instanceof SellerOrderServiceError || error instanceof SellerProfileServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

async function resolveSellerProfileId(userId: string, databaseUrl?: string) {
  const profile = await sellerProfileService.getProfile(userId, databaseUrl);

  return profile.id;
}

const listSellerOrdersRoute = createRoute({
  method: 'get',
  path: '/orders',
  tags: ['Seller Orders'],
  summary: 'List orders for events owned by the authenticated seller',
  request: {
    query: listSellerOrdersQuerySchema,
  },
  responses: {
    200: {
      description: 'Seller orders retrieved successfully',
      content: {
        'application/json': {
          schema: sellerOrdersListResponseSchema,
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
  },
});

const getSellerOrderDetailRoute = createRoute({
  method: 'get',
  path: '/orders/:id',
  tags: ['Seller Orders'],
  summary: 'Get seller order detail',
  request: {
    params: sellerOrderIdParamSchema,
  },
  responses: {
    200: {
      description: 'Seller order detail retrieved successfully',
      content: {
        'application/json': {
          schema: sellerOrderResponseSchema,
        },
      },
    },
    403: {
      description: 'Order does not belong to the current seller',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Order not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

app.openapi(listSellerOrdersRoute, async (c) => {
  const query = c.req.valid('query');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await sellerOrderService.listOrders(sellerProfileId, query, databaseUrl);

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(getSellerOrderDetailRoute, async (c) => {
  const params = c.req.valid('param');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await sellerOrderService.getOrderDetail(sellerProfileId, params.id, databaseUrl);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

export default app;
