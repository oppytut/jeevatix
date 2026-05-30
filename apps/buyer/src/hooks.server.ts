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

const buyerHandle: Handle = async ({ event, resolve }) => {
  setApiBinding(event.platform?.env?.Api);

  event.locals.buyerAccessToken = event.cookies.get(BUYER_ACCESS_TOKEN_COOKIE) ?? null;
  event.locals.buyerRefreshToken = event.cookies.get(BUYER_REFRESH_TOKEN_COOKIE) ?? null;
  event.locals.currentUser = parseStoredUserCookie(event.cookies.get(BUYER_USER_COOKIE));

  return resolve(event);
};

export const handle = sentryInit
  ? sequence(sentryInit, sentryHandle(), buyerHandle, securityHeadersHandle)
  : sequence(buyerHandle, securityHeadersHandle);

export const handleError = sentryDsn ? Sentry.handleErrorWithSentry() : undefined;
