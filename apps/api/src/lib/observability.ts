import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';

import type { AuthEnv } from '../middleware/auth';

export const REQUEST_ID_HEADER = 'X-Request-Id';

const REDACTED_VALUE = '[REDACTED]';
const REDACTED_EMAIL = '[REDACTED_EMAIL]';
const MAX_STACK_LINES = 8;
const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|secret|token|jwt|session/i;
const BEARER_TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9._-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const TOKEN_QUERY_PATTERN = /\b(access|refresh|reset|verify)[-_ ]?token=([^&\s;]+)/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

type LogLevel = 'error' | 'info' | 'warn';

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function redactSensitiveString(value: string) {
  return value
    .replace(BEARER_TOKEN_PATTERN, `Bearer ${REDACTED_VALUE}`)
    .replace(JWT_PATTERN, REDACTED_VALUE)
    .replace(TOKEN_QUERY_PATTERN, (_, tokenName: string) => `${tokenName}_token=${REDACTED_VALUE}`)
    .replace(EMAIL_PATTERN, REDACTED_EMAIL);
}

function sanitizeLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactSensitiveString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactSensitiveString(value.message),
      stack: value.stack
        ? redactSensitiveString(value.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n'))
        : undefined,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, seen));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular]';
    }

    seen.add(value);

    const sanitizedEntries = Object.entries(value).map(([key, entryValue]) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return [key, REDACTED_VALUE];
      }

      return [key, sanitizeLogValue(entryValue, seen)];
    });

    return Object.fromEntries(sanitizedEntries);
  }

  return String(value);
}

function writeLog(level: LogLevel, event: string, payload: Record<string, unknown>) {
  const entry = sanitizeLogValue({
    event,
    level,
    timestamp: new Date().toISOString(),
    ...payload,
  });

  const serializedEntry = JSON.stringify(entry);

  if (level === 'error') {
    console.error(serializedEntry);
    return;
  }

  if (level === 'warn') {
    console.warn(serializedEntry);
    return;
  }

  console.log(serializedEntry);
}

function getRequestColo(request: Request) {
  return (request as Request & { cf?: { colo?: string } }).cf?.colo;
}

function getRequestMetadata(request: Request, requestId: string) {
  const url = new URL(request.url);

  return {
    requestId,
    method: request.method,
    path: url.pathname,
    cfRay: request.headers.get('cf-ray') ?? undefined,
    colo: getRequestColo(request),
  };
}

function getRequestIdFromHeaders(headers: Headers) {
  const requestId = headers.get(REQUEST_ID_HEADER)?.trim();

  if (requestId) {
    return requestId.slice(0, 128);
  }

  return headers.get('cf-ray')?.trim() ?? crypto.randomUUID();
}

export function getAppVersion(env?: Partial<AuthEnv['Bindings']>) {
  return env?.APP_VERSION ?? getProcessEnv('APP_VERSION') ?? 'local-development';
}

export function getAppEnvironment(env?: Partial<AuthEnv['Bindings']>) {
  return env?.APP_ENVIRONMENT ?? getProcessEnv('APP_ENVIRONMENT') ?? 'development';
}

export function buildHealthPayload(env?: Partial<AuthEnv['Bindings']>) {
  return {
    status: 'ok' as const,
    service: 'api' as const,
    environment: getAppEnvironment(env),
    version: getAppVersion(env),
    timestamp: new Date().toISOString(),
  };
}

export function logErrorWithContext(
  event: string,
  error: unknown,
  payload: Record<string, unknown> = {},
) {
  writeLog('error', event, {
    ...payload,
    error,
  });
}

export const observabilityMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const requestId = getRequestIdFromHeaders(c.req.raw.headers);
  const startedAt = Date.now();

  c.set('requestId', requestId);
  c.header(REQUEST_ID_HEADER, requestId);

  await next();

  if (c.res.status >= 500 && !c.var.errorLogged) {
    logErrorWithContext(
      'http.server_error',
      new Error(`Request failed with status ${c.res.status}`),
      {
        ...getRequestMetadata(c.req.raw, requestId),
        status: c.res.status,
        durationMs: Date.now() - startedAt,
        environment: getAppEnvironment(c.env),
        version: getAppVersion(c.env),
      },
    );
  }
});

export function logUnhandledRequestError(c: Context<AuthEnv>, error: unknown) {
  const requestId = c.var.requestId ?? getRequestIdFromHeaders(c.req.raw.headers);

  c.set('errorLogged', true);
  c.header(REQUEST_ID_HEADER, requestId);

  logErrorWithContext('http.unhandled_exception', error, {
    ...getRequestMetadata(c.req.raw, requestId),
    status: 500,
    environment: getAppEnvironment(c.env),
    version: getAppVersion(c.env),
  });
}
