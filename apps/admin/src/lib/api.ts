import { browser } from '$app/environment';

import { clearClientSessionState, ensureFreshAccessToken, refreshBrowserSession } from '$lib/auth';
import { API_BASE_URL, ApiError } from '$lib/http';

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
};

type ApiSuccessEnvelope<T, TMeta = undefined> = ApiSuccessResponse<T> & {
  meta?: TMeta;
};

type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

type ApiEnvelopeResponse<T, TMeta = undefined> = ApiSuccessEnvelope<T, TMeta> | ApiFailureResponse;

type RequestOptions = {
  body?: unknown;
  headers?: HeadersInit;
  requiresAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return null;
  }

  return (await response.json()) as T;
}

async function buildAuthHeaders(requiresAuth: boolean) {
  if (!requiresAuth || !browser) {
    return {};
  }

  const accessToken = await ensureFreshAccessToken();

  if (!accessToken) {
    throw new ApiError('Authentication required.', 401, 'UNAUTHORIZED');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const { body, headers, requiresAuth = true, retryOnUnauthorized = true } = options;

  const authHeaders = await buildAuthHeaders(requiresAuth);
  const requestHeaders = new Headers(headers);

  requestHeaders.set('Accept', 'application/json');

  for (const [key, value] of Object.entries(authHeaders)) {
    requestHeaders.set(key, value);
  }

  if (body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && requiresAuth && retryOnUnauthorized && browser) {
    const refreshedAccessToken = await refreshBrowserSession();

    if (refreshedAccessToken) {
      return request<T>(method, path, { ...options, retryOnUnauthorized: false });
    }

    clearClientSessionState();
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

async function requestEnvelope<T, TMeta = undefined>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccessEnvelope<T, TMeta>> {
  const { body, headers, requiresAuth = true, retryOnUnauthorized = true } = options;

  const authHeaders = await buildAuthHeaders(requiresAuth);
  const requestHeaders = new Headers(headers);

  requestHeaders.set('Accept', 'application/json');

  for (const [key, value] of Object.entries(authHeaders)) {
    requestHeaders.set(key, value);
  }

  if (body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && requiresAuth && retryOnUnauthorized && browser) {
    const refreshedAccessToken = await refreshBrowserSession();

    if (refreshedAccessToken) {
      return requestEnvelope<T, TMeta>(method, path, { ...options, retryOnUnauthorized: false });
    }

    clearClientSessionState();
  }

  const payload = await parseJsonSafe<ApiEnvelopeResponse<T, TMeta>>(response);

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

  return payload;
}

export function apiGet<T>(path: string, options?: Omit<RequestOptions, 'body'>) {
  return request<T>('GET', path, options);
}

export function apiGetEnvelope<T, TMeta = undefined>(
  path: string,
  options?: Omit<RequestOptions, 'body'>,
) {
  return requestEnvelope<T, TMeta>('GET', path, options);
}

export function apiPost<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) {
  return request<T>('POST', path, { ...options, body });
}

export function apiPatch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) {
  return request<T>('PATCH', path, { ...options, body });
}

export function apiDelete<T>(path: string, options?: Omit<RequestOptions, 'body'>) {
  return request<T>('DELETE', path, options);
}

export { ApiError };
