import type { ErrorEvent, EventHint } from '@sentry/sveltekit';

const REDACTED = '[REDACTED]';
const REDACTED_EMAIL = '[REDACTED_EMAIL]';

const BEARER = /Bearer\s+[A-Za-z0-9._-]+/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const TOKEN_QS = /\b(access|refresh|reset|verify)[-_ ]?token=([^&\s;]+)/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const SENSITIVE_HEADER_PATTERN =
  /authorization|cookie|set-cookie|x-api-key|x-auth-token|proxy-authorization|x-forwarded-authorization/i;

export function redact(input: string): string {
  return input
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(JWT, REDACTED)
    .replace(TOKEN_QS, (_, n: string) => `${n}_token=${REDACTED}`)
    .replace(EMAIL, REDACTED_EMAIL);
}

function scrubBreadcrumbs(event: ErrorEvent) {
  if (!event.breadcrumbs) return;

  for (const crumb of event.breadcrumbs) {
    if (crumb.message) crumb.message = redact(crumb.message);
    if (crumb.data) {
      if (typeof crumb.data.url === 'string') {
        crumb.data.url = redact(crumb.data.url);
      }
      if (typeof crumb.data.input === 'string') {
        crumb.data.input = redact(crumb.data.input);
      }
      if (Array.isArray(crumb.data.arguments)) {
        crumb.data.arguments = crumb.data.arguments.map((arg: unknown) =>
          typeof arg === 'string' ? redact(arg) : arg,
        );
      }
    }
  }
}

export function scrubSentryEvent<
  T extends {
    message?: string;
    exception?: { values?: Array<{ value?: string }> };
    request?: ErrorEvent['request'];
    breadcrumbs?: ErrorEvent['breadcrumbs'];
  },
>(event: T, _hint?: EventHint): T {
  if (event.message) {
    event.message = redact(event.message);
  }

  if (event.exception?.values) {
    for (const exc of event.exception.values) {
      if (exc.value) exc.value = redact(exc.value);
    }
  }

  if (event.request?.headers) {
    for (const k of Object.keys(event.request.headers)) {
      if (SENSITIVE_HEADER_PATTERN.test(k)) {
        event.request.headers[k] = REDACTED;
      }
    }
  }

  if (event.request?.cookies) {
    delete event.request.cookies;
  }

  if (typeof event.request?.query_string === 'string') {
    event.request.query_string = redact(event.request.query_string);
  }

  scrubBreadcrumbs(event as unknown as ErrorEvent);

  return event;
}
