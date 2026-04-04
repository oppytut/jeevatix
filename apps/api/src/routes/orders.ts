import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../middleware/auth';
import { errorResponseSchema } from '../schemas/auth.schema';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  orderListResponseSchema,
  orderResponseSchema,
} from '../schemas/order.schema';
import { OrderServiceError, orderService } from '../services/order.service';

const app = new OpenAPIHono<AuthEnv>();

app.use('*', authMiddleware);
app.use('*', roleMiddleware('buyer'));

function jsonError(code: string, message: string) {
  return {
    success: false as const,
    error: {
      code,
      message,
    },
  };
}

function getStatusFromError(error: OrderServiceError) {
  switch (error.code) {
    case 'FORBIDDEN':
      return 403;
    case 'ORDER_NOT_FOUND':
    case 'RESERVATION_NOT_FOUND':
      return 404;
    case 'INVALID_STATE':
      return 409;
    case 'DATABASE_UNAVAILABLE':
    case 'ORDER_NUMBER_GENERATION_FAILED':
    case 'TICKET_RESERVER_UNAVAILABLE':
      return 500;
    default:
      return 400;
  }
}

function handleError(
  c: Parameters<typeof app.openapi>[1] extends (arg: infer T) => unknown ? T : never,
  error: unknown,
) {
  if (error instanceof OrderServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const createOrderRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Orders'],
  summary: 'Create a buyer order from an active reservation',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createOrderSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Order created successfully',
      content: {
        'application/json': {
          schema: orderResponseSchema,
        },
      },
    },
    404: {
      description: 'Reservation not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    409: {
      description: 'Reservation cannot be converted to an order',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const listOrdersRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Orders'],
  summary: 'List buyer orders',
  request: {
    query: listOrdersQuerySchema,
  },
  responses: {
    200: {
      description: 'Orders retrieved successfully',
      content: {
        'application/json': {
          schema: orderListResponseSchema,
        },
      },
    },
  },
});

const getOrderDetailRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Orders'],
  summary: 'Get buyer order detail',
  request: {
    params: orderIdParamSchema,
  },
  responses: {
    200: {
      description: 'Order detail retrieved successfully',
      content: {
        'application/json': {
          schema: orderResponseSchema,
        },
      },
    },
    403: {
      description: 'Order does not belong to the current buyer',
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

app.openapi(createOrderRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await orderService.createOrder(c.env, c.var.user.id, body);

    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(listOrdersRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await orderService.listOrders(c.env, c.var.user.id, query);

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(getOrderDetailRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await orderService.getOrderDetail(c.env, c.var.user.id, params.id);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
