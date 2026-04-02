import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, type AuthEnv, roleMiddleware } from '../../middleware/auth';
import { errorResponseSchema } from '../../schemas/auth.schema';
import {
  adminPaymentDetailResponseSchema,
  adminPaymentIdParamSchema,
  adminPaymentListQuerySchema,
  adminPaymentStatusResponseSchema,
  adminPaymentsListResponseSchema,
  updateAdminPaymentStatusSchema,
} from '../../schemas/admin.schema';
import {
  AdminPaymentServiceError,
  adminPaymentService,
} from '../../services/admin-payment.service';

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

function getStatusFromError(error: AdminPaymentServiceError) {
  switch (error.code) {
    case 'PAYMENT_NOT_FOUND':
    case 'RESERVATION_NOT_FOUND':
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
  if (error instanceof AdminPaymentServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const listPaymentsRoute = createRoute({
  method: 'get',
  path: '/payments',
  tags: ['Admin Payments'],
  summary: 'List all platform payments',
  request: {
    query: adminPaymentListQuerySchema,
  },
  responses: {
    200: {
      description: 'Payments retrieved successfully',
      content: {
        'application/json': {
          schema: adminPaymentsListResponseSchema,
        },
      },
    },
  },
});

const getPaymentDetailRoute = createRoute({
  method: 'get',
  path: '/payments/:id',
  tags: ['Admin Payments'],
  summary: 'Get payment detail for admin review',
  request: {
    params: adminPaymentIdParamSchema,
  },
  responses: {
    200: {
      description: 'Payment detail retrieved successfully',
      content: {
        'application/json': {
          schema: adminPaymentDetailResponseSchema,
        },
      },
    },
    404: {
      description: 'Payment not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const updatePaymentStatusRoute = createRoute({
  method: 'patch',
  path: '/payments/:id/status',
  tags: ['Admin Payments'],
  summary: 'Update payment status manually',
  request: {
    params: adminPaymentIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateAdminPaymentStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Payment status updated successfully',
      content: {
        'application/json': {
          schema: adminPaymentStatusResponseSchema,
        },
      },
    },
  },
});

app.openapi(listPaymentsRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await adminPaymentService.listPayments(query, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(getPaymentDetailRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await adminPaymentService.getPaymentDetail(
      params.id,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(updatePaymentStatusRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');

  try {
    const result = await adminPaymentService.updatePaymentStatus(
      params.id,
      body,
      c.env,
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
