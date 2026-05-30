import * as Sentry from '@sentry/sveltekit';
import { initCloudflareSentryHandle, sentryHandle } from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';

import {
  BUYER_ACCESS_TOKEN_COOKIE,
  BUYER_REFRESH_TOKEN_COOKIE,
  BUYER_USER_COOKIE,
  parseStoredUserCookie,
} from '$lib/auth';
import { setApiBinding } from '$lib/api-binding';
import { redact, scrubSentryEvent } from '$lib/sentry-scrub';
import { securityHeadersHandle } from '$lib/security-headers';

function getEnv(key: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[key] : undefined;
}

const sentryDsn = getEnv('SENTRY_DSN') ?? '';
const appEnvironment = getEnv('APP_ENVIRONMENT') ?? 'development';

const sentryInit: Handle | null = sentryDsn
  ? initCloudflareSentryHandle({
      dsn: sentryDsn,
      environment: appEnvironment,
      release: getEnv('APP_VERSION'),
      tracesSampleRate: appEnvironment === 'production' ? 0.1 : 1.0,
      sendDefaultPii: false,
      beforeSend: scrubSentryEvent,
      beforeSendTransaction: scrubSentryEvent,
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.message) breadcrumb.message = redact(breadcrumb.message);
        if (typeof breadcrumb.data?.url === 'string') {
          breadcrumb.data.url = redact(breadcrumb.data.url);
        }
        return breadcrumb;
      },
    })
  : null;

function deriveFeatureArea(routeId: string | null): string {
  if (!routeId) return 'unknown';
  if (routeId.startsWith('/login') || routeId.startsWith('/register') || routeId.startsWith('/forgot-password') || routeId.startsWith('/reset-password') || routeId.startsWith('/verify-email') || routeId.startsWith('/logout') || routeId.startsWith('/profile')) return 'auth';
  if (routeId.startsWith('/orders')) return 'orders';
  if (routeId.startsWith('/checkout') || routeId.startsWith('/payment')) return 'payments';
  if (routeId.startsWith('/tickets')) return 'tickets';
  if (routeId.startsWith('/events')) return 'events';
  if (routeId.startsWith('/notifications')) return 'notifications';
  if (routeId.startsWith('/sitemap') || routeId.startsWith('/robots') || routeId.startsWith('/session')) return 'infra';
  return 'home';
}

const buyerHandle: Handle = async ({ event, resolve }) => {
  setApiBinding(event.platform?.env?.Api);

  event.locals.buyerAccessToken = event.cookies.get(BUYER_ACCESS_TOKEN_COOKIE) ?? null;
  event.locals.buyerRefreshToken = event.cookies.get(BUYER_REFRESH_TOKEN_COOKIE) ?? null;
  event.locals.currentUser = parseStoredUserCookie(event.cookies.get(BUYER_USER_COOKIE));

  if (sentryDsn) {
    try {
      Sentry.setTag('portal', 'buyer');
      Sentry.setTag('route', event.route.id ?? event.url.pathname);
      Sentry.setTag('feature_area', deriveFeatureArea(event.route.id));
      const appVersion = getEnv('APP_VERSION');
      if (appVersion) Sentry.setTag('app_version', appVersion);
    } catch {
      // Defense in depth: never let observability instrumentation break the request.
    }

    if (event.locals.currentUser) {
      Sentry.setUser({ id: event.locals.currentUser.id });
    }
  }

  try {
    return await resolve(event);
  } finally {
    if (sentryDsn) {
      // Clear user context to prevent leaking across requests on a single Worker isolate.
      Sentry.setUser(null);
    }
  }
};

export const handle = sentryInit
  ? sequence(sentryInit, sentryHandle(), buyerHandle, securityHeadersHandle)
  : sequence(buyerHandle, securityHeadersHandle);

export const handleError = sentryDsn ? Sentry.handleErrorWithSentry() : undefined;
