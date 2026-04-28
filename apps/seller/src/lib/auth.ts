import type { Cookies } from '@sveltejs/kit';

import { browser, dev } from '$app/environment';
import { PUBLIC_API_BASE_URL } from '$env/static/public';

export const API_BASE_URL =
  PUBLIC_API_BASE_URL || (dev ? 'http://localhost:8787' : 'https://api.jeevatix.com');

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

export const SELLER_ACCESS_TOKEN_COOKIE = 'jeevatix_seller_access_token';
export const SELLER_REFRESH_TOKEN_COOKIE = 'jeevatix_seller_refresh_token';
export const SELLER_USER_COOKIE = 'jeevatix_seller_user';

const SESSION_ACCESS_TOKEN_ENDPOINT = '/session/access-token';
const SESSION_LOGOUT_ENDPOINT = '/session/logout';
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 30_000;
export const ACCESS_TOKEN_MAX_AGE = 60 * 15;
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;
export const USER_COOKIE_MAX_AGE = REFRESH_TOKEN_MAX_AGE;

export type SellerAuthUser = {
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
  user: SellerAuthUser;
};

type AuthResponse = {
  success: true;
  data: AuthPayload;
};

type SessionAccessTokenResponse = {
  success: true;
  data: {
    access_token: string;
  };
};

type ForgotPasswordPayload = {
  message: string;
};

type ForgotPasswordResponse = {
  success: true;
  data: ForgotPasswordPayload;
};

type MessagePayload = {
  message: string;
};

type MessageResponse = {
  success: true;
  data: MessagePayload;
};

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type JwtPayload = {
  exp?: number;
};

export type RegisterSellerInput = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  org_name: string;
  org_description?: string;
};

let accessTokenCache: string | null = null;
let accessTokenExpiresAt = 0;

function getCookieOptions(maxAge: number) {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: !dev,
    maxAge,
  };
}

function setAccessTokenCache(token: string | null) {
  accessTokenCache = token;
  accessTokenExpiresAt = token ? (decodeJwtPayload(token)?.exp ?? 0) : 0;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');

    if (!payload || typeof atob !== 'function') {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = atob(
      normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='),
    );

    return JSON.parse(decodedPayload) as JwtPayload;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string) {
  const payload = decodeJwtPayload(token);

  if (!payload?.exp) {
    return false;
  }

  return payload.exp * 1000 <= Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS;
}

function hasFreshAccessTokenCache() {
  if (!accessTokenCache) {
    return false;
  }

  if (!accessTokenExpiresAt) {
    return true;
  }

  return accessTokenExpiresAt * 1000 > Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS;
}

function ensureSellerRole(user: SellerAuthUser) {
  if (user.role !== 'seller') {
    throw new ApiError('Akun ini tidak memiliki akses seller.', 403, 'FORBIDDEN');
  }
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

async function requestSessionAccessToken(forceRefresh = false) {
  if (!browser) {
    return null;
  }

  if (!forceRefresh && hasFreshAccessTokenCache()) {
    return accessTokenCache;
  }

  const response = await fetch(SESSION_ACCESS_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ forceRefresh }),
  });

  try {
    const payload = await parseResponse<SessionAccessTokenResponse>(response);
    setAccessTokenCache(payload.data.access_token);
    return payload.data.access_token;
  } catch (error) {
    setAccessTokenCache(null);

    if (error instanceof ApiError) {
      return null;
    }

    throw error;
  }
}

export function parseStoredUserCookie(value?: string | null): SellerAuthUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as SellerAuthUser;
  } catch {
    return null;
  }
}

export function getUser(cookies: Cookies) {
  return parseStoredUserCookie(cookies.get(SELLER_USER_COOKIE));
}

export function isAuthenticated(cookies: Cookies) {
  const refreshToken = cookies.get(SELLER_REFRESH_TOKEN_COOKIE);
  const user = getUser(cookies);

  return Boolean(refreshToken && user?.role === 'seller');
}

export function shouldRefreshAccessToken(token?: string | null) {
  return !token || isTokenExpired(token);
}

export function persistStoredUser(cookies: Cookies, user: SellerAuthUser) {
  cookies.set(SELLER_USER_COOKIE, JSON.stringify(user), getCookieOptions(USER_COOKIE_MAX_AGE));
}

export function persistAuthSession(cookies: Cookies, payload: AuthPayload) {
  cookies.set(
    SELLER_ACCESS_TOKEN_COOKIE,
    payload.access_token,
    getCookieOptions(ACCESS_TOKEN_MAX_AGE),
  );
  cookies.set(
    SELLER_REFRESH_TOKEN_COOKIE,
    payload.refresh_token,
    getCookieOptions(REFRESH_TOKEN_MAX_AGE),
  );
  persistStoredUser(cookies, payload.user);
}

export function clearAuthSession(cookies: Cookies) {
  cookies.delete(SELLER_ACCESS_TOKEN_COOKIE, { path: '/' });
  cookies.delete(SELLER_REFRESH_TOKEN_COOKIE, { path: '/' });
  cookies.delete(SELLER_USER_COOKIE, { path: '/' });
}

export function clearClientSessionState() {
  setAccessTokenCache(null);
}

export async function login(
  fetchFn: typeof fetch,
  cookies: Cookies,
  email: string,
  password: string,
) {
  const response = await fetchFn(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const payload = await parseResponse<AuthResponse>(response);
  ensureSellerRole(payload.data.user);
  persistAuthSession(cookies, payload.data);

  return payload.data;
}

export async function registerSeller(
  fetchFn: typeof fetch,
  cookies: Cookies,
  input: RegisterSellerInput,
) {
  const response = await fetchFn(`${API_BASE_URL}/auth/register/seller`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = await parseResponse<AuthResponse>(response);
  ensureSellerRole(payload.data.user);
  persistAuthSession(cookies, payload.data);

  return payload.data;
}

export async function refreshSession(fetchFn: typeof fetch, cookies: Cookies) {
  const refreshToken = cookies.get(SELLER_REFRESH_TOKEN_COOKIE);

  if (!refreshToken) {
    return null;
  }

  const response = await fetchFn(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  try {
    const payload = await parseResponse<AuthResponse>(response);
    ensureSellerRole(payload.data.user);
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

export async function forgotPassword(email: string) {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
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

export async function resetPassword(token: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
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

export async function logoutSession(fetchFn: typeof fetch, cookies: Cookies) {
  const refreshToken = cookies.get(SELLER_REFRESH_TOKEN_COOKIE);

  try {
    if (refreshToken) {
      await fetchFn(`${API_BASE_URL}/auth/logout`, {
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

export async function ensureFreshAccessToken() {
  return requestSessionAccessToken(false);
}

export async function refreshBrowserSession() {
  return requestSessionAccessToken(true);
}

export async function logout() {
  try {
    if (browser) {
      await fetch(SESSION_LOGOUT_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
      });
    }
  } finally {
    clearClientSessionState();
  }
}
