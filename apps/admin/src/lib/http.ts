import { dev } from '$app/environment';
import { PUBLIC_API_BASE_URL } from '$env/static/public';

// Server-side (Worker-to-Worker) URL bypasses same-zone routing issues.
// Cloudflare returns 522 when one Worker fetches another via custom domain
// in the same zone. Use workers.dev URL for cross-Worker SSR fetches.
export const INTERNAL_API_URL = dev
  ? 'http://127.0.0.1:8787'
  : 'https://jeevatix-staging-api.ariefna95.workers.dev';

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
