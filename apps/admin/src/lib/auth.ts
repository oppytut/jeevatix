import { browser } from '$app/environment';

import { API_BASE_URL, ApiError } from '$lib/http';

export const ADMIN_ACCESS_TOKEN_COOKIE = 'jeevatix_admin_access_token';
export const ADMIN_REFRESH_TOKEN_COOKIE = 'jeevatix_admin_refresh_token';
export const ADMIN_USER_COOKIE = 'jeevatix_admin_user';

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 30_000;
export const ACCESS_TOKEN_MAX_AGE = 60 * 15;
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7;
export const USER_COOKIE_MAX_AGE = REFRESH_TOKEN_MAX_AGE;

export type AdminAuthUser = {
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
  user: AdminAuthUser;
};

type AuthResponse = {
  success: true;
  data: AuthPayload;
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

function readCookie(name: string) {
  if (!browser) {
    return null;
  }

  const prefix = `${name}=`;
  const cookie = document.cookie.split('; ').find((entry) => entry.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  if (!browser) {
    return;
  }

  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

function removeCookie(name: string) {
  if (!browser) {
    return;
  }

  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
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

export function parseStoredUserCookie(value?: string | null): AdminAuthUser | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AdminAuthUser;
  } catch {
    return null;
  }
}

export function getUser() {
  return parseStoredUserCookie(readCookie(ADMIN_USER_COOKIE));
}

export function getAccessToken() {
  return readCookie(ADMIN_ACCESS_TOKEN_COOKIE);
}

export function getRefreshToken() {
  return readCookie(ADMIN_REFRESH_TOKEN_COOKIE);
}

function persistAuthSession(payload: AuthPayload) {
  writeCookie(ADMIN_ACCESS_TOKEN_COOKIE, payload.access_token, ACCESS_TOKEN_MAX_AGE);
  writeCookie(ADMIN_REFRESH_TOKEN_COOKIE, payload.refresh_token, REFRESH_TOKEN_MAX_AGE);
  writeCookie(ADMIN_USER_COOKIE, JSON.stringify(payload.user), USER_COOKIE_MAX_AGE);
}

export function clearAuthSession() {
  removeCookie(ADMIN_ACCESS_TOKEN_COOKIE);
  removeCookie(ADMIN_REFRESH_TOKEN_COOKIE);
  removeCookie(ADMIN_USER_COOKIE);
}

async function parseAuthResponse(response: Response) {
  const payload = (await response.json()) as AuthResponse | ErrorResponse;

  if (!response.ok || !payload.success) {
    throw new ApiError(
      payload.success ? 'Request failed.' : payload.error.message,
      response.status,
      payload.success ? 'API_ERROR' : payload.error.code,
    );
  }

  return payload.data;
}

export async function refreshSession() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  try {
    const data = await parseAuthResponse(response);

    if (data.user.role !== 'admin') {
      clearAuthSession();
      throw new ApiError('Akun ini tidak memiliki akses admin.', 403, 'FORBIDDEN');
    }

    persistAuthSession(data);
    return data.access_token;
  } catch (error) {
    clearAuthSession();

    if (error instanceof ApiError) {
      return null;
    }

    throw error;
  }
}

export async function ensureFreshAccessToken() {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return refreshSession();
  }

  if (!isTokenExpired(accessToken)) {
    return accessToken;
  }

  return refreshSession();
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await parseAuthResponse(response);

  if (data.user.role !== 'admin') {
    clearAuthSession();
    throw new ApiError('Akun ini tidak memiliki akses admin.', 403, 'FORBIDDEN');
  }

  persistAuthSession(data);
  return data.user;
}

export async function logout() {
  const refreshToken = getRefreshToken();

  try {
    if (refreshToken) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    }
  } finally {
    clearAuthSession();
  }
}

export function isAuthenticated() {
  const user = getUser();
  return Boolean(user && user.role === 'admin' && getRefreshToken());
}
