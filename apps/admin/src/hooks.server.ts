import * as Sentry from '@sentry/sveltekit';
import { initCloudflareSentryHandle, sentryHandle } from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';

import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  ADMIN_USER_COOKIE,
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

const adminHandle: Handle = async ({ event, resolve }) => {
  setApiBinding(event.platform?.env?.Api);

  event.locals.adminAccessToken = event.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE) ?? null;
  event.locals.adminRefreshToken = event.cookies.get(ADMIN_REFRESH_TOKEN_COOKIE) ?? null;
  event.locals.currentUser = parseStoredUserCookie(event.cookies.get(ADMIN_USER_COOKIE));

  if (sentryDsn && event.locals.currentUser) {
    Sentry.setUser({ id: event.locals.currentUser.id });
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
  ? sequence(sentryInit, sentryHandle(), adminHandle, securityHeadersHandle)
  : sequence(adminHandle, securityHeadersHandle);

export const handleError = sentryDsn ? Sentry.handleErrorWithSentry() : undefined;
