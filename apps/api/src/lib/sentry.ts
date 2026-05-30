import type { CloudflareOptions } from '@sentry/cloudflare';
import type { ErrorEvent } from '@sentry/cloudflare';

import type { AuthEnv } from '../middleware/auth';
import { getAppEnvironment, getAppVersion } from './observability';

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
  'x-forwarded-authorization',
]);

const REDACTED_VALUE = '[REDACTED]';
const REDACTED_EMAIL = '[REDACTED_EMAIL]';
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9._-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const TOKEN_QUERY_PATTERN = /\b(access|refresh|reset|verify)[-_ ]?token=([^&\s;]+)/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

function redact(input: string) {
  return input
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(JWT_PATTERN, REDACTED_VALUE)
    .replace(TOKEN_QUERY_PATTERN, (_, name: string) => `${name}_token=${REDACTED_VALUE}`)
    .replace(EMAIL_PATTERN, REDACTED_EMAIL);
}

function parseSampleRate(raw: string | undefined, fallback: number) {
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n) || n < 0 || n > 1) return fallback;
  return n;
}

/**
 * Returns Sentry options derived from Worker env, or null if Sentry is disabled
 * (no DSN configured). Callers should bail out when null is returned.
 *
 * Defense-in-depth PII scrubbing matches the redaction rules in observability.ts;
 * the structured-log path already redacts before logging, this layer covers the
 * Sentry event path which doesn't go through writeLog().
 */
export function buildSentryOptions(env: AuthEnv['Bindings']): CloudflareOptions | null {
  const dsn = env.SENTRY_DSN?.trim();

  if (!dsn) {
    return null;
  }

  const environment = getAppEnvironment(env);

  return {
    dsn,
    environment,
    release: getAppVersion(env),
    // Default 10% in production, 100% elsewhere; override via env.
    tracesSampleRate: parseSampleRate(
      env.SENTRY_TRACES_SAMPLE_RATE,
      environment === 'production' ? 0.1 : 1.0,
    ),
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubEvent(event);
    },
    beforeSendTransaction(event) {
      return scrubEvent(event as unknown as ErrorEvent) as unknown as typeof event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.message) breadcrumb.message = redact(breadcrumb.message);
      if (typeof breadcrumb.data?.url === 'string') {
        breadcrumb.data.url = redact(breadcrumb.data.url);
      }
      return breadcrumb;
    },
  };
}

function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
        event.request.headers[key] = REDACTED_VALUE;
      }
    }
  }

  if (event.request?.cookies) {
    delete event.request.cookies;
  }

  if (event.request?.query_string && typeof event.request.query_string === 'string') {
    event.request.query_string = redact(event.request.query_string);
  }

  if (event.message) {
    event.message = redact(event.message);
  }

  if (event.exception?.values) {
    for (const exc of event.exception.values) {
      if (exc.value) {
        exc.value = redact(exc.value);
      }
    }
  }

  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.message) crumb.message = redact(crumb.message);
      if (crumb.data) {
        if (typeof crumb.data.url === 'string') crumb.data.url = redact(crumb.data.url);
        if (typeof crumb.data.input === 'string') crumb.data.input = redact(crumb.data.input);
        if (Array.isArray(crumb.data.arguments)) {
          crumb.data.arguments = crumb.data.arguments.map((arg: unknown) =>
            typeof arg === 'string' ? redact(arg) : arg,
          );
        }
      }
    }
  }

  return event;
}
