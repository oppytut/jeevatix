import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../middleware/auth';
import { errorResponseSchema } from '../schemas/auth.schema';
import {
  adminReservationListQuerySchema,
  adminReservationsListResponseSchema,
} from '../schemas/admin.schema';
import {
  createReservationSchema,
  reservationCreateResponseSchema,
  reservationIdParamSchema,
  reservationResponseSchema,
  reservationStateResponseSchema,
} from '../schemas/reservation.schema';
import { ReservationServiceError, reservationService } from '../services/reservation.service';

const app = new OpenAPIHono<AuthEnv>();
const adminApp = new OpenAPIHono<AuthEnv>();

app.use('*', authMiddleware);
app.use('*', roleMiddleware('buyer'));
adminApp.use('*', authMiddleware, roleMiddleware('admin'));

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

function handleError<TContext extends { json: (body: unknown, status?: number) => unknown }>(
  c: TContext,
  error: unknown,
): ReturnType<TContext['json']> {
  if (error instanceof ReservationServiceError) {
    return c.json(
      jsonError(error.code, error.message),
      getStatusFromError(error),
    ) as ReturnType<TContext['json']>;
  }

  return c.json(
    jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'),
    500,
  ) as ReturnType<TContext['json']>;
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

const listAdminReservationsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin Reservations'],
  summary: 'List reservations for admin monitoring',
  request: {
    query: adminReservationListQuerySchema,
  },
  responses: {
    200: {
      description: 'Reservations retrieved successfully',
      content: {
        'application/json': {
          schema: adminReservationsListResponseSchema,
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
    return handleError(c, error) as never;
  }
});

app.openapi(getReservationRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await reservationService.getReservation(
      c.var.user.id,
      params.id,
      c.env.DATABASE_URL,
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(cancelReservationRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await reservationService.cancelReservation(c.env, c.var.user.id, params.id);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

adminApp.openapi(listAdminReservationsRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await reservationService.listAdmin(query, c.env.DATABASE_URL);

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

export default app;
export { adminApp as adminReservationRoutes };
