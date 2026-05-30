import type { Handle } from '@sveltejs/kit';

function getEnv(key: string): string | undefined {
  return typeof process !== 'undefined' ? process.env?.[key] : undefined;
}

const isProduction = (getEnv('APP_ENVIRONMENT') ?? 'development') === 'production';

const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'camera=(self)',
  'display-capture=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

// CSP itself lives in `kit.csp` in svelte.config.js so SvelteKit can inject per-request nonces.
// This handle adds the remaining defense-in-depth headers that the framework does not set.
export const securityHeadersHandle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  if (!response.headers.has('X-Frame-Options')) {
    response.headers.set('X-Frame-Options', 'DENY');
  }
  if (!response.headers.has('X-Content-Type-Options')) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
  }
  if (!response.headers.has('Referrer-Policy')) {
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  if (!response.headers.has('Permissions-Policy')) {
    response.headers.set('Permissions-Policy', PERMISSIONS_POLICY);
  }
  if (!response.headers.has('Cross-Origin-Opener-Policy')) {
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  }

  if (isProduction && !response.headers.has('Strict-Transport-Security')) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
  }

  return response;
};
