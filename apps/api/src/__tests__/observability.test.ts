import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  REQUEST_ID_HEADER,
  logUnhandledRequestError,
  observabilityMiddleware,
} from '../lib/observability';
import type { AuthEnv } from '../middleware/auth';

function createObservabilityEnv() {
  return {
    APP_ENVIRONMENT: 'production',
    APP_VERSION: 'git-sha-test',
    BUCKET: {} as R2Bucket,
    JWT_SECRET: 'test-secret',
    TICKET_RESERVER: {} as DurableObjectNamespace,
  } satisfies AuthEnv['Bindings'];
}

describe('observability middleware', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs handled 5xx responses with a request id', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = new Hono<AuthEnv>();

    app.use('*', observabilityMiddleware);
    app.get('/handled-error', (c) => c.json({ success: false }, 500));

    const response = await app.request('/handled-error', undefined, createObservabilityEnv());

    expect(response.status).toBe(500);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('"event":"http.server_error"');
  });

  it('redacts sensitive values from unhandled exception logs', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = new Hono<AuthEnv>();

    app.use('*', observabilityMiddleware);
    app.onError((error, c) => {
      logUnhandledRequestError(c, error);
      return c.json({ success: false }, 500);
    });
    app.get('/explode', () => {
      throw new Error(
        'unexpected token for alice@example.com with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
      );
    });

    const response = await app.request(
      '/explode',
      {
        headers: {
          'CF-Ray': 'ray-test-id',
        },
      },
      createObservabilityEnv(),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe('ray-test-id');
    expect(errorSpy).toHaveBeenCalledOnce();

    const loggedLine = String(errorSpy.mock.calls[0]?.[0]);

    expect(loggedLine).toContain('"event":"http.unhandled_exception"');
    expect(loggedLine).not.toContain('alice@example.com');
    expect(loggedLine).not.toContain('eyJhbGci');
  });
});
