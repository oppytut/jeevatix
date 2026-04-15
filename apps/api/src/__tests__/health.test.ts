import { describe, expect, it } from 'vitest';

import app from '../index';
import { REQUEST_ID_HEADER } from '../lib/observability';
import type { AuthEnv } from '../middleware/auth';

function createHealthEnv() {
  return {
    APP_ENVIRONMENT: 'production',
    APP_VERSION: 'git-sha-test',
    BUCKET: {} as R2Bucket,
    JWT_SECRET: 'test-secret',
    TICKET_RESERVER: {} as DurableObjectNamespace,
  } satisfies AuthEnv['Bindings'];
}

describe('health endpoint', () => {
  it('returns status, timestamp, version, and environment metadata', async () => {
    const response = await app.request('/health', undefined, createHealthEnv());
    const payload = (await response.json()) as {
      environment: string;
      service: string;
      status: string;
      timestamp: string;
      version: string;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
    expect(payload.status).toBe('ok');
    expect(payload.service).toBe('api');
    expect(payload.environment).toBe('production');
    expect(payload.version).toBe('git-sha-test');
    expect(Number.isNaN(Date.parse(payload.timestamp))).toBe(false);
  });
});
