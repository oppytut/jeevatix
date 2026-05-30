import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { app } from '../index';
import { resetRateLimitState } from '../middleware/rate-limit';
import type { AuthEnv } from '../middleware/auth';

function createCspReportEnv() {
  return {
    APP_ENVIRONMENT: 'production',
    APP_VERSION: 'git-sha-test',
    BUCKET: {} as R2Bucket,
    JWT_SECRET: 'test-secret',
    TICKET_RESERVER: {} as DurableObjectNamespace,
  } satisfies AuthEnv['Bindings'];
}

describe('csp report endpoint', () => {
  beforeEach(() => {
    resetRateLimitState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 204 with permissive CORS headers for POST application/csp-report', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await app.request(
      '/csp-report',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/csp-report',
          'CF-Connecting-IP': '198.51.100.10',
        },
        body: JSON.stringify({
          'csp-report': {
            'document-uri': 'https://buyer.jeevatix.my.id/login',
            'violated-directive': 'script-src',
            'blocked-uri': 'https://evil.example.com/x.js',
            'source-file': 'https://buyer.jeevatix.my.id/login',
            'line-number': 42,
            'column-number': 12,
          },
        }),
      },
      createCspReportEnv(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(warnSpy).toHaveBeenCalledOnce();
    const logged = String(warnSpy.mock.calls[0]?.[0]);
    expect(logged).toContain('"event":"csp.violation_report"');
    expect(logged).toContain('"violatedDirective":"script-src"');
  });

  it('redacts emails, JWTs, and tokens from violated and document URIs', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await app.request(
      '/csp-report',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/csp-report',
          'CF-Connecting-IP': '198.51.100.11',
        },
        body: JSON.stringify({
          'csp-report': {
            'document-uri':
              'https://buyer.jeevatix.my.id/profile?email=alice@example.com&access_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature',
            'violated-directive': 'connect-src',
            'blocked-uri': 'https://evil.example.com/?email=bob@example.com',
            'source-file': 'https://buyer.jeevatix.my.id/profile',
          },
        }),
      },
      createCspReportEnv(),
    );

    expect(response.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledOnce();
    const logged = String(warnSpy.mock.calls[0]?.[0]);
    expect(logged).not.toContain('alice@example.com');
    expect(logged).not.toContain('bob@example.com');
    expect(logged).not.toContain('eyJhbGci');
    expect(logged).toContain('[REDACTED_EMAIL]');
  });

  it('handles application/reports+json (Reporting API) batch payloads', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await app.request(
      '/csp-report',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/reports+json',
          'CF-Connecting-IP': '198.51.100.12',
        },
        body: JSON.stringify([
          {
            type: 'csp-violation',
            age: 0,
            url: 'https://buyer.jeevatix.my.id/login',
            user_agent: 'Mozilla/5.0',
            body: {
              documentURL: 'https://buyer.jeevatix.my.id/login',
              effectiveDirective: 'script-src-elem',
              blockedURL: 'https://evil.example.com/x.js',
              sourceFile: 'https://buyer.jeevatix.my.id/login',
              lineNumber: 99,
              columnNumber: 5,
              disposition: 'report',
              statusCode: 200,
            },
          },
        ]),
      },
      createCspReportEnv(),
    );

    expect(response.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledOnce();
    const logged = String(warnSpy.mock.calls[0]?.[0]);
    expect(logged).toContain('"violatedDirective":"script-src-elem"');
    expect(logged).toContain('"disposition":"report"');
  });

  it('returns 204 even on malformed JSON payload', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await app.request(
      '/csp-report',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/csp-report',
          'CF-Connecting-IP': '198.51.100.13',
        },
        body: '{not valid json',
      },
      createCspReportEnv(),
    );

    expect(response.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('responds to OPTIONS preflight with permissive CORS', async () => {
    const response = await app.request(
      '/csp-report',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://buyer.jeevatix.my.id',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      },
      createCspReportEnv(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });

  it('rate-limits beyond 10 reports per second per IP', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const env = createCspReportEnv();
    const sharedHeaders = {
      'Content-Type': 'application/csp-report',
      'CF-Connecting-IP': '198.51.100.99',
    };
    const body = JSON.stringify({
      'csp-report': {
        'document-uri': 'https://buyer.jeevatix.my.id/',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.example.com/x.js',
      },
    });

    for (let i = 0; i < 10; i += 1) {
      const ok = await app.request(
        '/csp-report',
        { method: 'POST', headers: sharedHeaders, body },
        env,
      );
      expect(ok.status).toBe(204);
    }

    const blocked = await app.request(
      '/csp-report',
      { method: 'POST', headers: sharedHeaders, body },
      env,
    );
    expect(blocked.status).toBe(429);
  });
});
