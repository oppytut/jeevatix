import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, type AuthEnv, roleMiddleware } from '../../middleware/auth';
import { errorResponseSchema } from '../../schemas/auth.schema';
import {
  adminOrderActionResponseSchema,
  adminOrderDetailResponseSchema,
  adminOrderIdParamSchema,
  adminOrderListQuerySchema,
  adminOrdersListResponseSchema,
} from '../../schemas/admin.schema';
import { AdminOrderServiceError, adminOrderService } from '../../services/admin-order.service';

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

function getStatusFromError(error: AdminOrderServiceError) {
  switch (error.code) {
    case 'ORDER_NOT_FOUND':
      return 404;
    case 'INVALID_STATE':
      return 409;
    default:
      return 500;
  }
}

function handleError(
  c: Parameters<typeof app.openapi>[1] extends (arg: infer T) => unknown ? T : never,
  error: unknown,
) {
  if (error instanceof AdminOrderServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const listOrdersRoute = createRoute({
  method: 'get',
  path: '/orders',
  tags: ['Admin Orders'],
  summary: 'List all platform orders',
  request: {
    query: adminOrderListQuerySchema,
  },
  responses: {
    200: {
      description: 'Orders retrieved successfully',
      content: {
        'application/json': {
          schema: adminOrdersListResponseSchema,
        },
      },
    },
  },
});

const getOrderDetailRoute = createRoute({
  method: 'get',
  path: '/orders/:id',
  tags: ['Admin Orders'],
  summary: 'Get order detail for admin review',
  request: {
    params: adminOrderIdParamSchema,
  },
  responses: {
    200: {
      description: 'Order detail retrieved successfully',
      content: {
        'application/json': {
          schema: adminOrderDetailResponseSchema,
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

const refundOrderRoute = createRoute({
  method: 'post',
  path: '/orders/:id/refund',
  tags: ['Admin Orders'],
  summary: 'Refund an order',
  request: {
    params: adminOrderIdParamSchema,
  },
  responses: {
    200: {
      description: 'Order refunded successfully',
      content: {
        'application/json': {
          schema: adminOrderActionResponseSchema,
        },
      },
    },
  },
});

const cancelOrderRoute = createRoute({
  method: 'post',
  path: '/orders/:id/cancel',
  tags: ['Admin Orders'],
  summary: 'Cancel an order',
  request: {
    params: adminOrderIdParamSchema,
  },
  responses: {
    200: {
      description: 'Order cancelled successfully',
      content: {
        'application/json': {
          schema: adminOrderActionResponseSchema,
        },
      },
    },
  },
});

app.openapi(listOrdersRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await adminOrderService.listOrders(query, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(getOrderDetailRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await adminOrderService.getOrderDetail(params.id, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(refundOrderRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await adminOrderService.refundOrder(params.id, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(cancelOrderRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await adminOrderService.cancelOrder(params.id, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
