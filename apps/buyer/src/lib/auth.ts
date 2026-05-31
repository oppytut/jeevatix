import type { Cookies } from '@sveltejs/kit';

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

export const BUYER_ACCESS_TOKEN_COOKIE = 'jeevatix_buyer_access_token';
export const BUYER_REFRESH_TOKEN_COOKIE = 'jeevatix_buyer_refresh_token';
export const BUYER_USER_COOKIE = 'jeevatix_buyer_user';

const ACCESS_TOKEN_MAX_AGE = 60 * 15;
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;
const USER_COOKIE_MAX_AGE = REFRESH_TOKEN_MAX_AGE;

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

export type BuyerAuthUser = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: 'buyer' | 'seller' | 'admin';
  status: 'active' | 'suspended' | 'banned';
  email_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

type AuthPayload = {
  access_token: string;
  refresh_token: string;
  user: BuyerAuthUser;
};

type AuthResponse = {
  success: true;
  data: AuthPayload;
};

type MessageResponse = {
  success: true;
  data: {
    message: string;
  };
};

type ForgotPasswordResponse = {
  success: true;
  data: {
    message: string;
  };
};

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type RegisterInput = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
};

function getCookieOptions(maxAge: number) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: !dev,
    maxAge,
  };
}

async function parseResponse<T extends object>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ErrorResponse;

  if (!response.ok || ('success' in payload && payload.success === false)) {
    const errorPayload = payload as ErrorResponse;

    throw new ApiError(
      errorPayload.error?.message ?? 'Request failed.',
      response.status,
      errorPayload.error?.code ?? 'API_ERROR',
    );
  }

  return payload as T;
}

function ensureBuyerRole(user: BuyerAuthUser) {
  if (user.role !== 'buyer') {
    throw new ApiError('Akun ini tidak memiliki akses buyer.', 403, 'FORBIDDEN');
  }
}

export function parseStoredUserCookie(value?: string | null): BuyerAuthUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as BuyerAuthUser;
  } catch {
    return null;
  }
}

export function getUser(cookies: Cookies) {
  return parseStoredUserCookie(cookies.get(BUYER_USER_COOKIE));
}

export function isAuthenticated(cookies: Cookies) {
  const refreshToken = cookies.get(BUYER_REFRESH_TOKEN_COOKIE);
  const user = getUser(cookies);

  return Boolean(refreshToken && user?.role === 'buyer');
}

export function persistAuthSession(cookies: Cookies, payload: AuthPayload) {
  cookies.set(
    BUYER_ACCESS_TOKEN_COOKIE,
    payload.access_token,
    getCookieOptions(ACCESS_TOKEN_MAX_AGE),
  );
  cookies.set(
    BUYER_REFRESH_TOKEN_COOKIE,
    payload.refresh_token,
    getCookieOptions(REFRESH_TOKEN_MAX_AGE),
  );
  persistStoredUser(cookies, payload.user);
}

export function persistStoredUser(cookies: Cookies, user: BuyerAuthUser) {
  cookies.set(BUYER_USER_COOKIE, JSON.stringify(user), getCookieOptions(USER_COOKIE_MAX_AGE));
}

export function clearAuthSession(cookies: Cookies) {
  cookies.delete(BUYER_ACCESS_TOKEN_COOKIE, { path: '/' });
  cookies.delete(BUYER_REFRESH_TOKEN_COOKIE, { path: '/' });
  cookies.delete(BUYER_USER_COOKIE, { path: '/' });
}

export async function login(
  fetchFn: typeof fetch,
  cookies: Cookies,
  email: string,
  password: string,
) {
  const response = await fetchFn(`${INTERNAL_API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseResponse<AuthResponse>(response);
  ensureBuyerRole(payload.data.user);
  persistAuthSession(cookies, payload.data);

  return payload.data;
}

export async function register(fetchFn: typeof fetch, cookies: Cookies, input: RegisterInput) {
  const response = await fetchFn(`${INTERNAL_API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = await parseResponse<AuthResponse>(response);
  ensureBuyerRole(payload.data.user);
  persistAuthSession(cookies, payload.data);

  return payload.data;
}

export async function logout(fetchFn: typeof fetch, cookies: Cookies) {
  const refreshToken = cookies.get(BUYER_REFRESH_TOKEN_COOKIE);

  try {
    if (refreshToken) {
      await fetchFn(`${INTERNAL_API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    }
  } finally {
    clearAuthSession(cookies);
  }
}

export async function refreshSession(fetchFn: typeof fetch, cookies: Cookies) {
  const refreshToken = cookies.get(BUYER_REFRESH_TOKEN_COOKIE);

  if (!refreshToken) {
    return null;
  }

  const response = await fetchFn(`${INTERNAL_API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  try {
    const payload = await parseResponse<AuthResponse>(response);
    ensureBuyerRole(payload.data.user);
    persistAuthSession(cookies, payload.data);

    return payload.data.access_token;
  } catch (error) {
    clearAuthSession(cookies);

    if (error instanceof ApiError) {
      return null;
    }

    throw error;
  }
}

export async function forgotPassword(fetchFn: typeof fetch, email: string) {
  const response = await fetchFn(`${INTERNAL_API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email }),
  });

  const payload = await parseResponse<ForgotPasswordResponse>(response);
  return payload.data;
}

export async function resetPassword(fetchFn: typeof fetch, token: string, password: string) {
  const response = await fetchFn(`${INTERNAL_API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ token, password }),
  });

  const payload = await parseResponse<MessageResponse>(response);
  return payload.data;
}

export async function verifyEmail(fetchFn: typeof fetch, token: string) {
  const response = await fetchFn(`${INTERNAL_API_URL}/auth/verify-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ token }),
  });

  const payload = await parseResponse<MessageResponse>(response);
  return payload.data;
}
