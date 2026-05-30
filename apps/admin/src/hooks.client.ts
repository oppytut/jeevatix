import * as Sentry from '@sentry/sveltekit';

import { dev } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';

import { redact, scrubSentryEvent } from '$lib/sentry-scrub';

const PUBLIC_SENTRY_DSN = publicEnv.PUBLIC_SENTRY_DSN ?? '';

if (PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: PUBLIC_SENTRY_DSN,
    environment: dev ? 'development' : 'production',
    tracesSampleRate: dev ? 1.0 : 0.1,
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
  });
}

export const handleError = PUBLIC_SENTRY_DSN ? Sentry.handleErrorWithSentry() : undefined;
