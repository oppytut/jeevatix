import * as Sentry from '@sentry/sveltekit';
import { initCloudflareSentryHandle, sentryHandle } from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';

import {
  SELLER_ACCESS_TOKEN_COOKIE,
  SELLER_REFRESH_TOKEN_COOKIE,
  SELLER_USER_COOKIE,
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
  if (routeId.startsWith('/events')) {
    if (routeId.includes('/checkin')) return 'tickets';
    return 'events';
  }
  if (routeId.startsWith('/orders')) return 'orders';
  if (routeId.startsWith('/dashboard')) return 'sellers';
  if (routeId.startsWith('/session')) return 'infra';
  return 'home';
}

const sellerHandle: Handle = async ({ event, resolve }) => {
  setApiBinding(event.platform?.env?.Api);

  event.locals.sellerAccessToken = event.cookies.get(SELLER_ACCESS_TOKEN_COOKIE) ?? null;
  event.locals.sellerRefreshToken = event.cookies.get(SELLER_REFRESH_TOKEN_COOKIE) ?? null;
  event.locals.currentUser = parseStoredUserCookie(event.cookies.get(SELLER_USER_COOKIE));

  if (sentryDsn) {
    try {
      Sentry.setTag('portal', 'seller');
      Sentry.setTag('route', event.route.id ?? event.url.pathname);
      Sentry.setTag('feature_area', deriveFeatureArea(event.route.id));
      const appVersion = getEnv('APP_VERSION');
      if (appVersion) Sentry.setTag('app_version', appVersion);
    } catch {
      // Defense in depth: never let observability instrumentation break the request.
    }

    if (event.locals.currentUser) {
      Sentry.setUser({
        id: event.locals.currentUser.id,
        segment: event.locals.currentUser.role,
      });
      Sentry.setTag('user.role', event.locals.currentUser.role);
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
  ? sequence(sentryInit, sentryHandle(), sellerHandle, securityHeadersHandle)
  : sequence(sellerHandle, securityHeadersHandle);

export const handleError = sentryDsn ? Sentry.handleErrorWithSentry() : undefined;
