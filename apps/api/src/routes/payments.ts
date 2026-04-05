import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../middleware/auth';
import { errorResponseSchema } from '../schemas/auth.schema';
import {
  initiatePaymentResponseSchema,
  initiatePaymentSchema,
  paymentOrderIdParamSchema,
  paymentWebhookResponseSchema,
  paymentWebhookSchema,
} from '../schemas/payment.schema';
import { PaymentServiceError, paymentService } from '../services/payment.service';

const app = new OpenAPIHono<AuthEnv>();

app.use('/payments/*', authMiddleware);
app.use('/payments/*', roleMiddleware('buyer'));

function jsonError(code: string, message: string) {
  return {
    success: false as const,
    error: {
      code,
      message,
    },
  };
}

function getStatusFromError(error: PaymentServiceError) {
  switch (error.code) {
    case 'FORBIDDEN':
      return 403;
    case 'INVALID_SIGNATURE':
      return 401;
    case 'ORDER_NOT_FOUND':
    case 'PAYMENT_NOT_FOUND':
      return 404;
    case 'INVALID_STATE':
      return 409;
    case 'DATABASE_UNAVAILABLE':
    case 'PAYMENT_WEBHOOK_SECRET_MISSING':
    case 'RESERVATION_NOT_FOUND':
    case 'TICKET_RESERVER_UNAVAILABLE':
      return 500;
    default:
      return 400;
  }
}

function handleError(c: Context, error: unknown) {
  if (error instanceof PaymentServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const initiatePaymentRoute = createRoute({
  method: 'post',
  path: '/payments/:orderId/pay',
  tags: ['Payments'],
  summary: 'Initiate payment for a buyer order',
  request: {
    params: paymentOrderIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: initiatePaymentSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Payment initiated successfully',
      content: {
        'application/json': {
          schema: initiatePaymentResponseSchema,
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
    409: {
      description: 'Order cannot be paid in the current state',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const paymentWebhookRoute = createRoute({
  method: 'post',
  path: '/webhooks/payment',
  tags: ['Payments'],
  summary: 'Handle payment gateway webhook callback',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: paymentWebhookSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Webhook processed successfully',
      content: {
        'application/json': {
          schema: paymentWebhookResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid webhook signature',
      content: {
        'application/json': {
          schema: errorResponseSchema,
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
    409: {
      description: 'Payment cannot be processed in the current state',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

app.openapi(initiatePaymentRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');

  try {
    const result = await paymentService.initiatePayment(c.env, c.var.user.id, params.orderId, body);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(paymentWebhookRoute, async (c) => {
  const rawBody = await c.req.raw.clone().text();
  const body = c.req.valid('json');

  try {
    const result = await paymentService.handleWebhook(c.env, c.req.raw.headers, rawBody, body);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

export default app;
