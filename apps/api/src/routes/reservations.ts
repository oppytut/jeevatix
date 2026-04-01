import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../middleware/auth';
import { errorResponseSchema } from '../schemas/auth.schema';
import {
  createReservationSchema,
  reservationCreateResponseSchema,
  reservationIdParamSchema,
  reservationResponseSchema,
  reservationStateResponseSchema,
} from '../schemas/reservation.schema';
import { ReservationServiceError, reservationService } from '../services/reservation.service';

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

function getStatusFromError(error: ReservationServiceError) {
  switch (error.code) {
    case 'FORBIDDEN':
      return 403;
    case 'RESERVATION_NOT_FOUND':
    case 'TIER_NOT_FOUND':
      return 404;
    case 'ACTIVE_RESERVATION_EXISTS':
    case 'INVALID_STATE':
    case 'MAX_TICKETS_EXCEEDED':
    case 'SOLD_OUT':
      return 409;
    case 'DATABASE_UNAVAILABLE':
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
  if (error instanceof ReservationServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const createReservationRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Reservations'],
  summary: 'Create a buyer reservation',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createReservationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Reservation created successfully',
      content: {
        'application/json': {
          schema: reservationCreateResponseSchema,
        },
      },
    },
    404: {
      description: 'Ticket tier not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    409: {
      description: 'Reservation cannot be created in the current state',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const getReservationRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Reservations'],
  summary: 'Get a buyer reservation',
  request: {
    params: reservationIdParamSchema,
  },
  responses: {
    200: {
      description: 'Reservation retrieved successfully',
      content: {
        'application/json': {
          schema: reservationResponseSchema,
        },
      },
    },
    403: {
      description: 'Reservation does not belong to the current buyer',
      content: {
        'application/json': {
          schema: errorResponseSchema,
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
  },
});

const cancelReservationRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['Reservations'],
  summary: 'Cancel a buyer reservation',
  request: {
    params: reservationIdParamSchema,
  },
  responses: {
    200: {
      description: 'Reservation cancelled successfully',
      content: {
        'application/json': {
          schema: reservationStateResponseSchema,
        },
      },
    },
    403: {
      description: 'Reservation does not belong to the current buyer',
      content: {
        'application/json': {
          schema: errorResponseSchema,
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
      description: 'Reservation cannot be cancelled in the current state',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

app.openapi(createReservationRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await reservationService.reserve(c.env, c.var.user.id, body);

    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(getReservationRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await reservationService.getReservation(c.var.user.id, params.id, c.env.DATABASE_URL);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(cancelReservationRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await reservationService.cancelReservation(c.env, c.var.user.id, params.id);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;