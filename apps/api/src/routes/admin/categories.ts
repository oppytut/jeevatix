import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, type AuthEnv, roleMiddleware } from '../../middleware/auth';
import {
  categoryErrorResponseSchema,
  categoryIdParamSchema,
  categoryListResponseSchema,
  categoryMessageResponseSchema,
  categorySingleResponseSchema,
  createCategorySchema,
  updateCategorySchema,
} from '../../schemas/category.schema';
import { CategoryServiceError, categoryService } from '../../services/category.service';

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

function getStatusFromError(error: CategoryServiceError) {
  switch (error.code) {
    case 'CATEGORY_ALREADY_EXISTS':
    case 'CATEGORY_SLUG_ALREADY_EXISTS':
    case 'CATEGORY_HAS_EVENTS':
      return 409;
    case 'CATEGORY_NOT_FOUND':
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
  if (error instanceof CategoryServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const listCategoriesRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin Categories'],
  summary: 'List categories with event counts for admin management',
  responses: {
    200: {
      description: 'Categories retrieved successfully',
      content: {
        'application/json': {
          schema: categoryListResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: categoryErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Admin access required',
      content: {
        'application/json': {
          schema: categoryErrorResponseSchema,
        },
      },
    },
  },
});

const createCategoryRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Admin Categories'],
  summary: 'Create a new category',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createCategorySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Category created successfully',
      content: {
        'application/json': {
          schema: categorySingleResponseSchema,
        },
      },
    },
    409: {
      description: 'Category name or slug already exists',
      content: {
        'application/json': {
          schema: categoryErrorResponseSchema,
        },
      },
    },
  },
});

const updateCategoryRoute = createRoute({
  method: 'patch',
  path: '/:id',
  tags: ['Admin Categories'],
  summary: 'Update an existing category',
  request: {
    params: {
      schema: categoryIdParamSchema,
    },
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateCategorySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Category updated successfully',
      content: {
        'application/json': {
          schema: categorySingleResponseSchema,
        },
      },
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: categoryErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Category name or slug already exists',
      content: {
        'application/json': {
          schema: categoryErrorResponseSchema,
        },
      },
    },
  },
});

const deleteCategoryRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['Admin Categories'],
  summary: 'Delete a category that is not attached to any events',
  request: {
    params: {
      schema: categoryIdParamSchema,
    },
  },
  responses: {
    200: {
      description: 'Category deleted successfully',
      content: {
        'application/json': {
          schema: categoryMessageResponseSchema,
        },
      },
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: categoryErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Category still has attached events',
      content: {
        'application/json': {
          schema: categoryErrorResponseSchema,
        },
      },
    },
  },
});

app.openapi(listCategoriesRoute, async (c) => {
  try {
    const result = await categoryService.listAdmin(getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(createCategoryRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await categoryService.create(body, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(updateCategoryRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');

  try {
    const result = await categoryService.update(
      params.id,
      body,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(deleteCategoryRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await categoryService.remove(params.id, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
