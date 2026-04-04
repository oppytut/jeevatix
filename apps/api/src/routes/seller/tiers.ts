import { createRoute, OpenAPIHono } from '@hono/zod-openapi';

import { messageResponseSchema } from '../../schemas/auth.schema';
import { authMiddleware, roleMiddleware, type AuthEnv } from '../../middleware/auth';
import {
  createTierSchema,
  sellerEventTierByIdParamsSchema,
  sellerEventTierParamsSchema,
  sellerTierErrorResponseSchema,
  sellerTierListResponseSchema,
  sellerTierResponseSchema,
  updateTierSchema,
} from '../../schemas/tier.schema';
import {
  SellerProfileServiceError,
  sellerProfileService,
} from '../../services/seller-profile.service';
import { TierServiceError, tierService } from '../../services/tier.service';

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

function getStatusFromError(error: TierServiceError | SellerProfileServiceError) {
  switch (error.code) {
    case 'FORBIDDEN':
      return 403;
    case 'PRICE_LOCKED':
    case 'QUOTA_BELOW_SOLD_COUNT':
    case 'TIER_HAS_SALES':
      return 409;
    case 'EVENT_NOT_FOUND':
    case 'SELLER_PROFILE_NOT_FOUND':
    case 'TIER_NOT_FOUND':
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
  if (error instanceof TierServiceError || error instanceof SellerProfileServiceError) {
    return c.json(jsonError(error.code, error.message), getStatusFromError(error));
  }

  return c.json(jsonError('INTERNAL_SERVER_ERROR', 'Unexpected error occurred.'), 500);
}

async function resolveSellerProfileId(userId: string, databaseUrl?: string) {
  const profile = await sellerProfileService.getProfile(userId, databaseUrl);

  return profile.id;
}

const listTiersRoute = createRoute({
  method: 'get',
  path: '/events/:id/tiers',
  tags: ['Seller Tiers'],
  summary: 'List ticket tiers for a seller event',
  request: {
    params: sellerEventTierParamsSchema,
  },
  responses: {
    200: {
      description: 'Ticket tiers retrieved successfully',
      content: {
        'application/json': {
          schema: sellerTierListResponseSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: sellerTierErrorResponseSchema,
        },
      },
    },
  },
});

const createTierRoute = createRoute({
  method: 'post',
  path: '/events/:id/tiers',
  tags: ['Seller Tiers'],
  summary: 'Create a ticket tier for a seller event',
  request: {
    params: sellerEventTierParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: createTierSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Ticket tier created successfully',
      content: {
        'application/json': {
          schema: sellerTierResponseSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: sellerTierErrorResponseSchema,
        },
      },
    },
  },
});

const updateTierRoute = createRoute({
  method: 'patch',
  path: '/events/:id/tiers/:tierId',
  tags: ['Seller Tiers'],
  summary: 'Update a ticket tier for a seller event',
  request: {
    params: sellerEventTierByIdParamsSchema,
    body: {
      required: true,
      content: {
        'application/json': {
          schema: updateTierSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Ticket tier updated successfully',
      content: {
        'application/json': {
          schema: sellerTierResponseSchema,
        },
      },
    },
    404: {
      description: 'Event or ticket tier not found',
      content: {
        'application/json': {
          schema: sellerTierErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Ticket tier cannot be updated in its current state',
      content: {
        'application/json': {
          schema: sellerTierErrorResponseSchema,
        },
      },
    },
  },
});

const deleteTierRoute = createRoute({
  method: 'delete',
  path: '/events/:id/tiers/:tierId',
  tags: ['Seller Tiers'],
  summary: 'Delete a ticket tier for a seller event',
  request: {
    params: sellerEventTierByIdParamsSchema,
  },
  responses: {
    200: {
      description: 'Ticket tier deleted successfully',
      content: {
        'application/json': {
          schema: messageResponseSchema,
        },
      },
    },
    404: {
      description: 'Event or ticket tier not found',
      content: {
        'application/json': {
          schema: sellerTierErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Ticket tier cannot be deleted after sales exist',
      content: {
        'application/json': {
          schema: sellerTierErrorResponseSchema,
        },
      },
    },
  },
});

app.openapi(listTiersRoute, async (c) => {
  const params = c.req.valid('param');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await tierService.listTiers(sellerProfileId, params.id, databaseUrl);

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(createTierRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await tierService.createTier(sellerProfileId, params.id, body, databaseUrl);

    return c.json({ success: true, data: result }, 201);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(updateTierRoute, async (c) => {
  const params = c.req.valid('param');
  const body = c.req.valid('json');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await tierService.updateTier(
      sellerProfileId,
      params.id,
      params.tierId,
      body,
      databaseUrl,
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

app.openapi(deleteTierRoute, async (c) => {
  const params = c.req.valid('param');
  const databaseUrl = getDatabaseUrl(c.env.DATABASE_URL);

  try {
    const sellerProfileId = await resolveSellerProfileId(c.var.user.id, databaseUrl);
    const result = await tierService.deleteTier(
      sellerProfileId,
      params.id,
      params.tierId,
      databaseUrl,
    );

    return c.json({ success: true, data: result }, 200);
  } catch (error) {
    return handleError(c, error);
  }
});

export default app;
