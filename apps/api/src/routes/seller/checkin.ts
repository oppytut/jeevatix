import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../../middleware/auth';
import { errorResponseSchema } from '../../schemas/auth.schema';
import {
  checkinEventParamsSchema,
  checkinResponseSchema,
  checkinSchema,
  checkinStatsResponseSchema,
} from '../../schemas/checkin.schema';
import { CheckinServiceError, checkinService } from '../../services/checkin.service';

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

function getStatusFromError(error: CheckinServiceError) {
  switch (error.code) {
    case 'FORBIDDEN':
      return 403;
    case 'EVENT_NOT_FOUND':
      return 404;
    case 'DATABASE_UNAVAILABLE':
      return 500;
    default:
      return 400;
  }
}

function handleError(c: Context, error: unknown) {
  if (error instanceof CheckinServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const submitCheckinRoute = createRoute({
  method: 'post',
  path: '/events/:id/checkin',
  tags: ['Seller Check-in'],
  summary: 'Validate and check in a ticket for a seller event',
  request: {
    params: checkinEventParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: checkinSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Check-in request processed successfully',
      content: {
        'application/json': {
          schema: checkinResponseSchema,
        },
      },
    },
    403: {
      description: 'Seller does not own this event',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

const getCheckinStatsRoute = createRoute({
  method: 'get',
  path: '/events/:id/checkin/stats',
  tags: ['Seller Check-in'],
  summary: 'Get check-in statistics and recent history for a seller event',
  request: {
    params: checkinEventParamsSchema,
  },
  responses: {
    200: {
      description: 'Check-in statistics retrieved successfully',
      content: {
        'application/json': {
          schema: checkinStatsResponseSchema,
        },
      },
    },
    403: {
      description: 'Seller does not own this event',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
});

app.openapi(submitCheckinRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const result = await checkinService.checkin(
      c.var.user.id,
      params.id,
      body.ticket_code,
      databaseUrl,
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(getCheckinStatsRoute, async (c) => {
  const params = c.req.valid('param');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const result = await checkinService.getStats(c.var.user.id, params.id, databaseUrl);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

export default app;
