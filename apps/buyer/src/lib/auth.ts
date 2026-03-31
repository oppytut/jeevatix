import type { Cookies } from '@sveltejs/kit';

export const API_BASE_URL = 'http://localhost:8787';

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
  verify_email_token?: string;
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
    reset_token?: string;
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
    secure: false,
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
  cookies.set(
    BUYER_USER_COOKIE,
    JSON.stringify(payload.user),
    getCookieOptions(USER_COOKIE_MAX_AGE),
  );
}

export function clearAuthSession(cookies: Cookies) {
  cookies.delete(BUYER_ACCESS_TOKEN_COOKIE, { path: '/' });
  cookies.delete(BUYER_REFRESH_TOKEN_COOKIE, { path: '/' });
  cookies.delete(BUYER_USER_COOKIE, { path: '/' });
}

export async function login(fetchFn: typeof fetch, cookies: Cookies, email: string, password: string) {
  const response = await fetchFn(`${API_BASE_URL}/auth/login`, {
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
  const response = await fetchFn(`${API_BASE_URL}/auth/register`, {
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

export async function refreshSession(fetchFn: typeof fetch, cookies: Cookies) {
  const refreshToken = cookies.get(BUYER_REFRESH_TOKEN_COOKIE);

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
  const response = await fetchFn(`${API_BASE_URL}/auth/forgot-password`, {
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
  const response = await fetchFn(`${API_BASE_URL}/auth/reset-password`, {
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
  const response = await fetchFn(`${API_BASE_URL}/auth/verify-email`, {
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