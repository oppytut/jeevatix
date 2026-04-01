import { browser } from '$app/environment';

export const API_BASE_URL = 'http://localhost:8787';

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

type ForgotPasswordPayload = {
  message: string;
  reset_token?: string;
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

type RegisterSellerInput = {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  org_name: string;
  org_description?: string;
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

function ensureSellerRole(user: SellerAuthUser) {
  if (user.role !== 'seller') {
    clearAuthSession();
    throw new ApiError('Akun ini tidak memiliki akses seller.', 403, 'FORBIDDEN');
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

export function getUser() {
  return parseStoredUserCookie(readCookie(SELLER_USER_COOKIE));
}

export function getAccessToken() {
  return readCookie(SELLER_ACCESS_TOKEN_COOKIE);
}

export function getRefreshToken() {
  return readCookie(SELLER_REFRESH_TOKEN_COOKIE);
}

function persistAuthSession(payload: AuthPayload) {
  writeCookie(SELLER_ACCESS_TOKEN_COOKIE, payload.access_token, ACCESS_TOKEN_MAX_AGE);
  writeCookie(SELLER_REFRESH_TOKEN_COOKIE, payload.refresh_token, REFRESH_TOKEN_MAX_AGE);
  writeCookie(SELLER_USER_COOKIE, JSON.stringify(payload.user), USER_COOKIE_MAX_AGE);
}

export function clearAuthSession() {
  removeCookie(SELLER_ACCESS_TOKEN_COOKIE);
  removeCookie(SELLER_REFRESH_TOKEN_COOKIE);
  removeCookie(SELLER_USER_COOKIE);
}

async function parseResponse<T extends object>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | ErrorResponse;

  if (!response.ok || ('success' in payload && payload.success === false)) {
    const errorPayload = payload as ErrorResponse;

    throw new ApiError(errorPayload.error?.message ?? 'Request failed.', response.status, errorPayload.error?.code ?? 'API_ERROR');
  }

  return payload as T;
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
    const payload = await parseResponse<AuthResponse>(response);
    ensureSellerRole(payload.data.user);
    persistAuthSession(payload.data);

    return payload.data.access_token;
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

  const payload = await parseResponse<AuthResponse>(response);
  ensureSellerRole(payload.data.user);
  persistAuthSession(payload.data);

  return payload.data.user;
}

export async function registerSeller(input: RegisterSellerInput) {
  const response = await fetch(`${API_BASE_URL}/auth/register/seller`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });

  const payload = await parseResponse<AuthResponse>(response);
  ensureSellerRole(payload.data.user);
  persistAuthSession(payload.data);

  return payload.data.user;
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

  return Boolean(user && user.role === 'seller' && getRefreshToken());
}