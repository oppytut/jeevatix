import * as Sentry from '@sentry/cloudflare';
import { createMiddleware } from 'hono/factory';

import type { AuthEnv } from '../middleware/auth';
import { getAppVersion } from './observability';

const FEATURE_AREA_BY_PREFIX: Array<{ prefix: string; area: string }> = [
  { prefix: '/auth', area: 'auth' },
  { prefix: '/users', area: 'auth' },
  { prefix: '/orders', area: 'orders' },
  { prefix: '/admin/orders', area: 'orders' },
  { prefix: '/seller/orders', area: 'orders' },
  { prefix: '/payments', area: 'payments' },
  { prefix: '/webhooks/payment', area: 'payments' },
  { prefix: '/admin/payments', area: 'payments' },
  { prefix: '/reservations', area: 'reservations' },
  { prefix: '/admin/reservations', area: 'reservations' },
  { prefix: '/tickets', area: 'tickets' },
  { prefix: '/seller/checkin', area: 'tickets' },
  { prefix: '/events', area: 'events' },
  { prefix: '/admin/events', area: 'events' },
  { prefix: '/admin/categories', area: 'events' },
  { prefix: '/seller/events', area: 'events' },
  { prefix: '/seller/tiers', area: 'events' },
  { prefix: '/seller/profile', area: 'sellers' },
  { prefix: '/seller/dashboard', area: 'sellers' },
  { prefix: '/admin/dashboard', area: 'admin' },
  { prefix: '/admin/users', area: 'admin' },
  { prefix: '/notifications', area: 'notifications' },
  { prefix: '/admin/notifications', area: 'notifications' },
  { prefix: '/upload', area: 'uploads' },
  { prefix: '/health', area: 'health' },
  { prefix: '/doc', area: 'docs' },
  { prefix: '/reference', area: 'docs' },
];

export function resolveFeatureArea(path: string): string {
  let bestMatch: { prefix: string; area: string } | undefined;

  for (const candidate of FEATURE_AREA_BY_PREFIX) {
    if (path === candidate.prefix || path.startsWith(`${candidate.prefix}/`)) {
      if (!bestMatch || candidate.prefix.length > bestMatch.prefix.length) {
        bestMatch = candidate;
      }
    }
  }

  return bestMatch?.area ?? 'unknown';
}

export const sentryTagsMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  try {
    const url = new URL(c.req.raw.url);
    Sentry.setTag('portal', 'api');
    Sentry.setTag('route', c.req.routePath ?? url.pathname);
    Sentry.setTag('feature_area', resolveFeatureArea(url.pathname));
    Sentry.setTag('app_version', getAppVersion(c.env));
  } catch {
    // Defense in depth: never let observability instrumentation break the request.
  }

  await next();
});
