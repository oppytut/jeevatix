import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, type AuthEnv, roleMiddleware } from '../../middleware/auth';
import { errorResponseSchema } from '../../schemas/auth.schema';
import {
  adminEventDetailResponseSchema,
  adminEventIdParamSchema,
  adminEventListQuerySchema,
  adminEventStatusResponseSchema,
  adminEventsListResponseSchema,
  updateAdminEventStatusSchema,
} from '../../schemas/admin.schema';
import { AdminEventServiceError, adminEventService } from '../../services/admin-event.service';

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

function handleError(
  c: Parameters<typeof app.openapi>[1] extends (arg: infer T) => unknown ? T : never,
  error: unknown,
) {
  if (error instanceof AdminEventServiceError) {
    return c.json(jsonError(error.code, error.message), error.code === 'EVENT_NOT_FOUND' ? 404 : 500);
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const listEventsRoute = createRoute({
  method: 'get',
  path: '/events',
  tags: ['Admin Events'],
  summary: 'List all events for admin management',
  request: {
    query: adminEventListQuerySchema,
  },
  responses: {
    200: {
      description: 'Events retrieved successfully',
      content: {
        'application/json': {
          schema: adminEventsListResponseSchema,
        },
      },
    },
  },
});

const getEventDetailRoute = createRoute({
  method: 'get',
  path: '/events/:id',
  tags: ['Admin Events'],
  summary: 'Get event detail for admin review',
  request: {
    params: adminEventIdParamSchema,
  },
  responses: {
    200: {
      description: 'Event detail retrieved successfully',
      content: {
        'application/json': {
          schema: adminEventDetailResponseSchema,
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

const updateEventStatusRoute = createRoute({
  method: 'patch',
  path: '/events/:id/status',
  tags: ['Admin Events'],
  summary: 'Update event status as admin',
  request: {
    params: adminEventIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateAdminEventStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Event status updated successfully',
      content: {
        'application/json': {
          schema: adminEventStatusResponseSchema,
        },
      },
    },
  },
});

app.openapi(listEventsRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await adminEventService.listEvents(query, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(getEventDetailRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await adminEventService.getEventDetail(params.id, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(updateEventStatusRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');

  try {
    const result = await adminEventService.updateEventStatus(
      params.id,
      body,
      c.var.user.id,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
