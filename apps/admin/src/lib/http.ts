import { browser, dev } from '$app/environment';
import { PUBLIC_API_BASE_URL } from '$env/static/public';

// Server-side (Worker-to-Worker) URL bypasses Cloudflare same-zone 522
// where one Worker fetches another via custom domain in the same zone.
// Configurable via INTERNAL_API_URL env var (injected by SST through
// the Worker environment binding) so each stage points at the right API
// without a source change.
//
// No production fallback URL is provided here on purpose. Silently routing
// production SSR traffic to a staging API would be a critical data leak,
// so the module fails fast at runtime if the env var is missing in non-dev
// mode. Set the GitHub variable PRODUCTION_INTERNAL_API_URL (or
// STAGING_INTERNAL_API_URL) and re-deploy if you see the resolver error.
//
// process.env is read directly (instead of $env/dynamic/private) because
// this module is also imported by client-reachable code; SvelteKit's guard
// rejects $env/{dynamic,static}/private imports anywhere on the client
// graph. process.env is populated by Cloudflare Workers from the Worker
// environment when nodejs_compat is enabled, and is undefined-guarded
// for the browser bundle.

function readInternalApiUrlEnv(): string | undefined {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }
  return process.env.INTERNAL_API_URL;
}

function resolveInternalApiUrl(): string {
  // Browser bundle never uses INTERNAL_API_URL — client code calls API_BASE_URL
  // (public CORS endpoint) and routes that need SSR-only fetches live in
  // +page.server.ts. Returning a sentinel here keeps the security guard intact
  // for SSR (where `browser === false`) while preventing module-load crashes
  // during client hydration. If browser code accidentally references this
  // sentinel as a URL, fetch will surface a clear parse error instead of a
  // silent fallback.
  if (browser) {
    return '__INTERNAL_API_URL_SERVER_ONLY__';
  }

  const fromEnv = readInternalApiUrlEnv();

  if (fromEnv) {
    return fromEnv;
  }

  if (dev) {
    return 'http://127.0.0.1:8787';
  }

  throw new Error(
    'INTERNAL_API_URL is required in non-dev runtime. ' +
      'Set it via the SST Worker environment binding (GH var ' +
      'PRODUCTION_INTERNAL_API_URL / STAGING_INTERNAL_API_URL).',
  );
}

export const INTERNAL_API_URL = resolveInternalApiUrl();
export const API_BASE_URL =
  PUBLIC_API_BASE_URL || (dev ? 'http://127.0.0.1:8787' : 'https://api.jeevatix.com');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string = 'API_ERROR',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
