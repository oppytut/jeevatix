import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../middleware/auth';
import { errorResponseSchema } from '../schemas/auth.schema';
import {
  listTicketsQuerySchema,
  ticketIdParamSchema,
  ticketListResponseSchema,
  ticketResponseSchema,
} from '../schemas/ticket.schema';
import { TicketServiceError, ticketService } from '../services/ticket-generator';

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

function getStatusFromError(error: TicketServiceError) {
  switch (error.code) {
    case 'FORBIDDEN':
      return 403;
    case 'ORDER_NOT_FOUND':
    case 'TICKET_NOT_FOUND':
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
  if (error instanceof TicketServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const listTicketsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Tickets'],
  summary: 'List buyer tickets',
  request: {
    query: listTicketsQuerySchema,
  },
  responses: {
    200: {
      description: 'Tickets retrieved successfully',
      content: {
        'application/json': {
          schema: ticketListResponseSchema,
        },
      },
    },
  },
});

const getTicketDetailRoute = createRoute({
  method: 'get',
  path: '/:id',
  tags: ['Tickets'],
  summary: 'Get buyer ticket detail including QR data',
  request: {
    params: ticketIdParamSchema,
  },
  responses: {
    200: {
      description: 'Ticket retrieved successfully',
      content: {
        'application/json': {
          schema: ticketResponseSchema,
        },
      },
    },
    403: {
      description: 'Ticket does not belong to the current buyer',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Ticket not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

app.openapi(listTicketsRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await ticketService.listTickets(c.var.user.id, query, c.env.DATABASE_URL);

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(getTicketDetailRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await ticketService.getTicketDetail(
      c.var.user.id,
      params.id,
      c.env.DATABASE_URL,
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
