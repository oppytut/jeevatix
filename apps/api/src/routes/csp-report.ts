import { OpenAPIHono } from '@hono/zod-openapi';

import { logWarnWithContext, redact } from '../lib/observability';
import type { AuthEnv } from '../middleware/auth';
import { cspReportRateLimitMiddleware } from '../middleware/rate-limit';

const app = new OpenAPIHono<AuthEnv>();

const ALLOWED_REPORT_CONTENT_TYPES = ['application/csp-report', 'application/reports+json'];
const MAX_REPORT_BODY_BYTES = 16 * 1024;

type CspReportRecord = Record<string, unknown>;

function applyCorsHeaders(response: Response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

function noContent() {
  return applyCorsHeaders(new Response(null, { status: 204 }));
}

function redactIfString(value: unknown): unknown {
  return typeof value === 'string' ? redact(value) : value;
}

function pickString(record: CspReportRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? redact(value) : undefined;
}

function pickNumber(record: CspReportRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function extractCspReportRecords(payload: unknown): CspReportRecord[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const wrapper = payload as { 'csp-report'?: unknown };

  if (wrapper['csp-report'] && typeof wrapper['csp-report'] === 'object') {
    return [wrapper['csp-report'] as CspReportRecord];
  }

  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const reportEntry = entry as { type?: unknown; body?: unknown };

        if (
          reportEntry.type === 'csp-violation' &&
          reportEntry.body &&
          typeof reportEntry.body === 'object'
        ) {
          return reportEntry.body as CspReportRecord;
        }

        return null;
      })
      .filter((entry): entry is CspReportRecord => entry !== null);
  }

  return [payload as CspReportRecord];
}

app.options('/csp-report', () => applyCorsHeaders(new Response(null, { status: 204 })));

app.post('/csp-report', cspReportRateLimitMiddleware, async (c) => {
  const contentType = c.req.header('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';

  if (!ALLOWED_REPORT_CONTENT_TYPES.includes(contentType)) {
    return noContent();
  }

  const rawBody = await c.req.raw.text().catch(() => '');

  if (!rawBody || rawBody.length > MAX_REPORT_BODY_BYTES) {
    return noContent();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return noContent();
  }

  const records = extractCspReportRecords(parsed);

  for (const record of records) {
    const portalSource =
      typeof record['portal'] === 'string' ? record['portal'] : c.req.header('referer');

    logWarnWithContext('csp.violation_report', {
      portal: typeof portalSource === 'string' ? redact(portalSource) : undefined,
      documentUri: pickString(record, 'document-uri') ?? pickString(record, 'documentURL'),
      violatedDirective:
        pickString(record, 'violated-directive') ?? pickString(record, 'effectiveDirective'),
      blockedUri: pickString(record, 'blocked-uri') ?? pickString(record, 'blockedURL'),
      sourceFile: pickString(record, 'source-file') ?? pickString(record, 'sourceFile'),
      lineNumber: pickNumber(record, 'line-number') ?? pickNumber(record, 'lineNumber'),
      columnNumber: pickNumber(record, 'column-number') ?? pickNumber(record, 'columnNumber'),
      disposition: pickString(record, 'disposition'),
      statusCode: pickNumber(record, 'status-code') ?? pickNumber(record, 'statusCode'),
      referrer: redactIfString(record['referrer']),
    });
  }

  return noContent();
});

export default app;
