import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';

import {
  listEventsQuerySchema,
  publicCategoriesResponseSchema,
  publicCategoryEventsQuerySchema,
  publicCategorySlugParamSchema,
  publicEventDetailResponseSchema,
  publicEventErrorResponseSchema,
  publicEventSlugParamSchema,
  publicEventsListResponseSchema,
} from '../schemas/public-event.schema';
import { PublicEventServiceError, publicEventService } from '../services/public-event.service';

const app = new OpenAPIHono();

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

function getStatusFromError(error: PublicEventServiceError) {
  switch (error.code) {
    case 'CATEGORY_NOT_FOUND':
    case 'EVENT_NOT_FOUND':
      return 404;
    case 'DATABASE_UNAVAILABLE':
      return 500;
    default:
      return 400;
  }
}

function handleError(c: Context, error: unknown) {
  if (error instanceof PublicEventServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const listEventsRoute = createRoute({
  method: 'get',
  path: '/events',
  tags: ['Public Events'],
  summary: 'List public events',
  request: {
    query: listEventsQuerySchema,
  },
  responses: {
    200: {
      description: 'Public events retrieved successfully',
      content: {
        'application/json': {
          schema: publicEventsListResponseSchema,
        },
      },
    },
    500: {
      description: 'Database unavailable',
      content: {
        'application/json': {
          schema: publicEventErrorResponseSchema,
        },
      },
    },
  },
});

const listFeaturedEventsRoute = createRoute({
  method: 'get',
  path: '/events/featured',
  tags: ['Public Events'],
  summary: 'List featured public events',
  responses: {
    200: {
      description: 'Featured events retrieved successfully',
      content: {
        'application/json': {
          schema: publicEventsListResponseSchema,
        },
      },
    },
    500: {
      description: 'Database unavailable',
      content: {
        'application/json': {
          schema: publicEventErrorResponseSchema,
        },
      },
    },
  },
});

const getEventBySlugRoute = createRoute({
  method: 'get',
  path: '/events/:slug',
  tags: ['Public Events'],
  summary: 'Get public event detail by slug',
  request: {
    params: publicEventSlugParamSchema,
  },
  responses: {
    200: {
      description: 'Event detail retrieved successfully',
      content: {
        'application/json': {
          schema: publicEventDetailResponseSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: publicEventErrorResponseSchema,
        },
      },
    },
  },
});

const listCategoriesRoute = createRoute({
  method: 'get',
  path: '/categories',
  tags: ['Public Events'],
  summary: 'List public event categories',
  responses: {
    200: {
      description: 'Categories retrieved successfully',
      content: {
        'application/json': {
          schema: publicCategoriesResponseSchema,
        },
      },
    },
    500: {
      description: 'Database unavailable',
      content: {
        'application/json': {
          schema: publicEventErrorResponseSchema,
        },
      },
    },
  },
});

const listCategoryEventsRoute = createRoute({
  method: 'get',
  path: '/categories/:slug/events',
  tags: ['Public Events'],
  summary: 'List public events by category',
  request: {
    params: publicCategorySlugParamSchema,
    query: publicCategoryEventsQuerySchema,
  },
  responses: {
    200: {
      description: 'Category events retrieved successfully',
      content: {
        'application/json': {
          schema: publicEventsListResponseSchema,
        },
      },
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: publicEventErrorResponseSchema,
        },
      },
    },
  },
});

app.openapi(listEventsRoute, async (c) => {
  const query = c.req.valid('query');
  const databaseUrl = getDatabaseUrl();

  try {
    const result = await publicEventService.listEvents(query, databaseUrl);
    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(listFeaturedEventsRoute, async (c) => {
  const databaseUrl = getDatabaseUrl();

  try {
    const data = await publicEventService.listFeatured(databaseUrl);
    return c.json(
      {
        success: true,
        data,
        meta: {
          total: data.length,
          page: 1,
          limit: data.length === 0 ? 10 : data.length,
          totalPages: data.length === 0 ? 0 : 1,
        },
      },
      200,
    );
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(getEventBySlugRoute, async (c) => {
  const params = c.req.valid('param');
  const databaseUrl = getDatabaseUrl();

  try {
    const result = await publicEventService.getBySlug(params.slug, databaseUrl);
    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(listCategoriesRoute, async (c) => {
  const databaseUrl = getDatabaseUrl();

  try {
    const result = await publicEventService.listCategories(databaseUrl);
    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

app.openapi(listCategoryEventsRoute, async (c) => {
  const params = c.req.valid('param');
  const query = c.req.valid('query');
  const databaseUrl = getDatabaseUrl();

  try {
    const result = await publicEventService.listByCategory(params.slug, query, databaseUrl);
    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error) as never;
  }
});

export default app;
