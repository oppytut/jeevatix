import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, roleMiddleware, type AuthEnv } from '../../middleware/auth';
import {
  createEventSchema,
  sellerEventDetailResponseSchema,
  sellerEventErrorResponseSchema,
  sellerEventIdParamSchema,
  sellerEventsListResponseSchema,
  sellerEventsQuerySchema,
  updateEventSchema,
} from '../../schemas/event.schema';
import { SellerProfileServiceError, sellerProfileService } from '../../services/seller-profile.service';
import { EventServiceError, eventService } from '../../services/event.service';
import { messageResponseSchema } from '../../schemas/auth.schema';

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

function getStatusFromError(error: EventServiceError | SellerProfileServiceError) {
  switch (error.code) {
    case 'FORBIDDEN':
      return 403;
    case 'CATEGORY_NOT_FOUND':
      return 400;
    case 'INVALID_EVENT_STATE':
      return 409;
    case 'EVENT_NOT_FOUND':
    case 'SELLER_PROFILE_NOT_FOUND':
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
  if (error instanceof EventServiceError || error instanceof SellerProfileServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

async function resolveSellerProfileId(
  userId: string,
  databaseUrl?: string,
) {
  const profile = await sellerProfileService.getProfile(userId, databaseUrl);

  return profile.id;
}

const listSellerEventsRoute = createRoute({
  method: 'get',
  path: '/events',
  tags: ['Seller Events'],
  summary: 'List seller events',
  request: {
    query: sellerEventsQuerySchema,
  },
  responses: {
    200: {
      description: 'Seller events retrieved successfully',
      content: {
        'application/json': {
          schema: sellerEventsListResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: sellerEventErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Seller role required',
      content: {
        'application/json': {
          schema: sellerEventErrorResponseSchema,
        },
      },
    },
  },
});

const createSellerEventRoute = createRoute({
  method: 'post',
  path: '/events',
  tags: ['Seller Events'],
  summary: 'Create a new seller event',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createEventSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Seller event created successfully',
      content: {
        'application/json': {
          schema: sellerEventDetailResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid request payload',
      content: {
        'application/json': {
          schema: sellerEventErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Seller profile or category not found',
      content: {
        'application/json': {
          schema: sellerEventErrorResponseSchema,
        },
      },
    },
  },
});

const getSellerEventRoute = createRoute({
  method: 'get',
  path: '/events/:id',
  tags: ['Seller Events'],
  summary: 'Get seller event detail',
  request: {
    params: sellerEventIdParamSchema,
  },
  responses: {
    200: {
      description: 'Seller event detail retrieved successfully',
      content: {
        'application/json': {
          schema: sellerEventDetailResponseSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: sellerEventErrorResponseSchema,
        },
      },
    },
  },
});

const updateSellerEventRoute = createRoute({
  method: 'patch',
  path: '/events/:id',
  tags: ['Seller Events'],
  summary: 'Update seller event',
  request: {
    params: sellerEventIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateEventSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Seller event updated successfully',
      content: {
        'application/json': {
          schema: sellerEventDetailResponseSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: sellerEventErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Event cannot be updated in its current state',
      content: {
        'application/json': {
          schema: sellerEventErrorResponseSchema,
        },
      },
    },
  },
});

const deleteSellerEventRoute = createRoute({
  method: 'delete',
  path: '/events/:id',
  tags: ['Seller Events'],
  summary: 'Delete a draft seller event',
  request: {
    params: sellerEventIdParamSchema,
  },
  responses: {
    200: {
      description: 'Seller event deleted successfully',
      content: {
        'application/json': {
          schema: messageResponseSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: sellerEventErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Only draft events can be deleted',
      content: {
        'application/json': {
          schema: sellerEventErrorResponseSchema,
        },
      },
    },
  },
});

app.openapi(listSellerEventsRoute, async (c) => {
  const query = c.req.valid('query');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await eventService.listSellerEvents(sellerProfileId, query, databaseUrl);

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(createSellerEventRoute, async (c) => {
  const body = c.req.valid('json');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await eventService.createEvent(sellerProfileId, body, databaseUrl);

    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(getSellerEventRoute, async (c) => {
  const params = c.req.valid('param');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await eventService.getSellerEvent(sellerProfileId, params.id, databaseUrl);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(updateSellerEventRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await eventService.updateEvent(sellerProfileId, params.id, body, databaseUrl);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(deleteSellerEventRoute, async (c) => {
  const params = c.req.valid('param');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await eventService.deleteEvent(sellerProfileId, params.id, databaseUrl);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;