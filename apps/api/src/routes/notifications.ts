import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { authMiddleware, type AuthEnv, roleMiddleware } from '../middleware/auth';
import {
  adminNotificationListQuerySchema,
  adminNotificationsListResponseSchema,
  broadcastNotificationResponseSchema,
  broadcastSchema,
  notificationErrorResponseSchema,
  notificationIdParamSchema,
  notificationListResponseSchema,
  notificationListQuerySchema,
  notificationReadAllResponseSchema,
  notificationResponseSchema,
} from '../schemas/notification.schema';
import {
  NotificationServiceError,
  notificationService,
} from '../services/notification.service';

const app = new OpenAPIHono<AuthEnv>();
const adminApp = new OpenAPIHono<AuthEnv>();

app.use('*', authMiddleware);
adminApp.use('*', authMiddleware, roleMiddleware('admin'));

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

function getStatusFromError(error: NotificationServiceError) {
  switch (error.code) {
    case 'NOTIFICATION_NOT_FOUND':
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
  if (error instanceof NotificationServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

const listNotificationsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Notifications'],
  summary: 'List notifications for the authenticated user',
  request: {
    query: notificationListQuerySchema,
  },
  responses: {
    200: {
      description: 'Notifications retrieved successfully',
      content: {
        'application/json': {
          schema: notificationListResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: notificationErrorResponseSchema,
        },
      },
    },
  },
});

const markReadRoute = createRoute({
  method: 'patch',
  path: '/:id/read',
  tags: ['Notifications'],
  summary: 'Mark a notification as read',
  request: {
    params: notificationIdParamSchema,
  },
  responses: {
    200: {
      description: 'Notification marked as read successfully',
      content: {
        'application/json': {
          schema: notificationResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: notificationErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Notification not found',
      content: {
        'application/json': {
          schema: notificationErrorResponseSchema,
        },
      },
    },
  },
});

const markAllReadRoute = createRoute({
  method: 'patch',
  path: '/read-all',
  tags: ['Notifications'],
  summary: 'Mark all notifications as read for the authenticated user',
  responses: {
    200: {
      description: 'All notifications marked as read successfully',
      content: {
        'application/json': {
          schema: notificationReadAllResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: notificationErrorResponseSchema,
        },
      },
    },
  },
});

const broadcastNotificationsRoute = createRoute({
  method: 'post',
  path: '/broadcast',
  tags: ['Admin Notifications'],
  summary: 'Broadcast a notification to all users or a target role',
  request: {
    body: {
      required: true,
      content: {
        'application/json': {
          schema: broadcastSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Broadcast notification sent successfully',
      content: {
        'application/json': {
          schema: broadcastNotificationResponseSchema,
        },
      },
    },
    401: {
      description: 'Authentication required',
      content: {
        'application/json': {
          schema: notificationErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Admin access required',
      content: {
        'application/json': {
          schema: notificationErrorResponseSchema,
        },
      },
    },
  },
});

const adminListNotificationsRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Admin Notifications'],
  summary: 'List notifications across the platform for admin review',
  request: {
    query: adminNotificationListQuerySchema,
  },
  responses: {
    200: {
      description: 'Notifications retrieved successfully',
      content: {
        'application/json': {
          schema: adminNotificationsListResponseSchema,
        },
      },
    },
  },
});

app.openapi(listNotificationsRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await notificationService.listForUser(
      c.var.user.id,
      query,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(markAllReadRoute, async (c) => {
  try {
    const result = await notificationService.markAllAsRead(
      c.var.user.id,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(markReadRoute, async (c) => {
  const params = c.req.valid('param');

  try {
    const result = await notificationService.markAsRead(
      c.var.user.id,
      params.id,
      getDatabaseUrl(c.env.DATABASE_URL),
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

adminApp.openapi(broadcastNotificationsRoute, async (c) => {
  const body = c.req.valid('json');

  try {
    const result = await notificationService.broadcast(body, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

adminApp.openapi(adminListNotificationsRoute, async (c) => {
  const query = c.req.valid('query');

  try {
    const result = await notificationService.listAdmin(query, getDatabaseUrl(c.env.DATABASE_URL));

    return c.json({ success: true, data: result.data, meta: result.meta }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
export { adminApp as adminNotificationRoutes };