import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, type AuthEnv, roleMiddleware } from '../../middleware/auth';
import {
  adminSellerIdParamSchema,
  adminSellerVerifyResponseSchema,
  adminSellersListResponseSchema,
  adminUserDetailResponseSchema,
  adminUserErrorResponseSchema,
  adminUserIdParamSchema,
  adminUsersListResponseSchema,
  adminUserStatusResponseSchema,
  listSellersQuerySchema,
  listUsersQuerySchema,
  updateUserStatusSchema,
  verifySellerSchema,
} from '../../schemas/admin-user.schema';
import { AdminUserServiceError, adminUserService } from '../../services/admin-user.service';

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

function getStatusFromError(error: AdminUserServiceError) {
  switch (error.code) {
    case 'CANNOT_UPDATE_SELF':
      return 403;
    case 'USER_NOT_FOUND':
    case 'SELLER_NOT_FOUND':
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
  if (error instanceof AdminUserServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const listUsersRoute = createRoute({
  method: 'get',
  path: '/users',
  tags: ['Admin Users'],
  summary: 'List users for admin management',
  request: {
    query: listUsersQuerySchema,
  },
  responses: {
    200: {
      description: 'Users retrieved successfully',
      content: {
        'application/json': {
          schema: adminUsersListResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: adminUserErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Admin access required',
      content: {
        'application/json': {
          schema: adminUserErrorResponseSchema,
        },
      },
    },
  },
});

const getUserDetailRoute = createRoute({
  method: 'get',
  path: '/users/:id',
  tags: ['Admin Users'],
  summary: 'Get user detail for admin review',
  request: {
    params: adminUserIdParamSchema,
  },
  responses: {
    200: {
      description: 'User detail retrieved successfully',
      content: {
        'application/json': {
          schema: adminUserDetailResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: adminUserErrorResponseSchema,
        },
      },
    },
  },
});

const updateUserStatusRoute = createRoute({
  method: 'patch',
  path: '/users/:id/status',
  tags: ['Admin Users'],
  summary: 'Update user status',
  request: {
    params: adminUserIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateUserStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'User status updated successfully',
      content: {
        'application/json': {
          schema: adminUserStatusResponseSchema,
        },
      },
    },
    404: {
      description: 'User not found',
      content: {
        'application/json': {
          schema: adminUserErrorResponseSchema,
        },
      },
    },
  },
});

const listSellersRoute = createRoute({
  method: 'get',
  path: '/sellers',
  tags: ['Admin Users'],
  summary: 'List seller profiles with verification status',
  request: {
    query: listSellersQuerySchema,
  },
  responses: {
    200: {
      description: 'Sellers retrieved successfully',
      content: {
        'application/json': {
          schema: adminSellersListResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: adminUserErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Admin access required',
      content: {
        'application/json': {
          schema: adminUserErrorResponseSchema,
        },
      },
    },
  },
});

const verifySellerRoute = createRoute({
  method: 'patch',
  path: '/sellers/:id/verify',
  tags: ['Admin Users'],
  summary: 'Approve or reject seller verification',
  request: {
    params: adminSellerIdParamSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: verifySellerSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Seller verification updated successfully',
      content: {
        'application/json': {
          schema: adminSellerVerifyResponseSchema,
        },
      },
    },
    404: {
      description: 'Seller profile not found',
      content: {
        'application/json': {
          schema: adminUserErrorResponseSchema,
        },
      },
    },
  },
});

app.openapi(listUsersRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await adminUserService.listUsers(query, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(getUserDetailRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await adminUserService.getUserDetail(
      params.id,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(updateUserStatusRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');
  const adminUser = c.var.user;

  try {
    const result = await adminUserService.updateUserStatus(
      params.id,
      body,
      adminUser.id,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(listSellersRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await adminUserService.listSellers(query, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(verifySellerRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');
  const adminUser = c.var.user;

  try {
    const result = await adminUserService.verifySeller(
      params.id,
      body,
      adminUser.id,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
