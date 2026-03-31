import type { Cookies } from '@sveltejs/kit';

import {
  API_BASE_URL,
  ApiError,
  BUYER_ACCESS_TOKEN_COOKIE,
  clearAuthSession,
  refreshSession,
} from '$lib/auth';

type ApiErrorPayload = {
  code: string;
  message: string;
};

type ApiFailureResponse = {
  success: false;
  error: ApiErrorPayload;
};

type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  meta?: unknown;
};

type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

type RequestOptions = {
  body?: BodyInit | Record<string, unknown> | unknown;
  headers?: HeadersInit;
  requiresAuth?: boolean;
  retryOnUnauthorized?: boolean;
  fetchFn: typeof fetch;
  cookies?: Cookies;
};

function isFormDataBody(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData;
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return null;
  }

  return (await response.json()) as T;
}

async function buildAuthHeaders(requiresAuth: boolean, cookies?: Cookies) {
  if (!requiresAuth) {
    return {};
  }

  const accessToken = cookies?.get(BUYER_ACCESS_TOKEN_COOKIE);

  if (!accessToken) {
    throw new ApiError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function request<T>(method: string, path: string, options: RequestOptions): Promise<T> {
  const {
    body,
    headers,
    requiresAuth = true,
    retryOnUnauthorized = true,
    fetchFn,
    cookies,
  } = options;

  const authHeaders = await buildAuthHeaders(requiresAuth, cookies);
  const requestHeaders = new Headers(headers);

  requestHeaders.set('Accept', 'application/json');

  for (const [key, value] of Object.entries(authHeaders)) {
    requestHeaders.set(key, value);
  }

  if (body !== undefined && !isFormDataBody(body)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetchFn(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body:
      body === undefined ? undefined : isFormDataBody(body) ? body : JSON.stringify(body),
  });

  if (response.status === 401 && requiresAuth && retryOnUnauthorized && cookies) {
    const refreshedAccessToken = await refreshSession(fetchFn, cookies);

    if (refreshedAccessToken) {
      return request<T>(method, path, { ...options, retryOnUnauthorized: false });
    }

    clearAuthSession(cookies);
  }

  const payload = await parseJsonSafe<ApiResponse<T>>(response);

  if (!response.ok) {
    throw new ApiError(
      payload && !payload.success ? payload.error.message : 'Request failed.',
      response.status,
      payload && !payload.success ? payload.error.code : 'API_ERROR',
    );
  }

  if (!payload || !payload.success) {
    throw new ApiError('Invalid API response.', response.status, 'INVALID_RESPONSE');
  }

  return payload.data;
}

export function apiGet<T>(
  path: string,
  options: Omit<RequestOptions, 'body'>,
) {
  return request<T>('GET', path, options);
}

export function apiPost<T>(
  path: string,
  body: unknown,
  options: Omit<RequestOptions, 'body'>,
) {
  return request<T>('POST', path, { ...options, body });
}

export function apiPatch<T>(
  path: string,
  body: unknown,
  options: Omit<RequestOptions, 'body'>,
) {
  return request<T>('PATCH', path, { ...options, body });
}

export { ApiError };