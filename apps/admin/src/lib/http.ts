import { dev } from '$app/environment';
import { PUBLIC_API_BASE_URL } from '$env/static/public';

// Server-side (Worker-to-Worker) URL bypasses same-zone routing issues.
// Cloudflare returns 522 when one Worker fetches another via custom domain
// in the same zone. Configurable via INTERNAL_API_URL env var (injected
// through SST Worker environment) so production can point at the production
// workers.dev URL without a source change. Falls back to the staging
// workers.dev URL when the var is unset.
//
// process.env is read directly (instead of $env/dynamic/private) because
// this module is also imported by client-reachable code; SvelteKit's guard
// rejects $env/{dynamic,static}/private imports anywhere on the client
// graph. process.env is populated by Cloudflare Workers from the Worker
// environment when nodejs_compat is enabled, and is undefined-guarded
// for the browser bundle.
const INTERNAL_API_URL_FALLBACK_PROD = 'https://jeevatix-staging-api.ariefna95.workers.dev';

function readInternalApiUrlEnv(): string | undefined {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }
  return process.env.INTERNAL_API_URL;
}

export const INTERNAL_API_URL =
  readInternalApiUrlEnv() || (dev ? 'http://127.0.0.1:8787' : INTERNAL_API_URL_FALLBACK_PROD);
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
