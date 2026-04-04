import type { Cookies } from '@sveltejs/kit';

import {
  API_BASE_URL,
  ApiError,
  BUYER_ACCESS_TOKEN_COOKIE,
  clearAuthSession,
  refreshSession,
} from '$lib/auth';

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type PublicCategory = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  event_count: number;
};

export type PublicEventCategory = {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
};

export type PublicEventListItem = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  banner_url: string | null;
  venue_name: string;
  venue_city: string;
  start_at: string;
  end_at: string;
  sale_start_at: string;
  sale_end_at: string;
  status: 'published' | 'ongoing';
  is_featured: boolean;
  max_tickets_per_order: number;
  min_price: number | null;
};

export type PublicEventImage = {
  id: string;
  image_url: string;
  sort_order: number;
  created_at: string;
};

export type PublicEventTier = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  quota: number;
  sold_count: number;
  remaining: number;
  sort_order: number;
  status: 'available' | 'sold_out' | 'hidden';
  sale_start_at: string | null;
  sale_end_at: string | null;
};

export type PublicEventSeller = {
  id: string;
  org_name: string;
  org_description: string | null;
  logo_url: string | null;
  is_verified: boolean;
};

export type PublicEventDetail = {
  id: string;
  seller_profile_id: string;
  slug: string;
  title: string;
  description: string | null;
  venue_name: string;
  venue_address: string | null;
  venue_city: string;
  venue_latitude: number | null;
  venue_longitude: number | null;
  start_at: string;
  end_at: string;
  sale_start_at: string;
  sale_end_at: string;
  banner_url: string | null;
  status: 'published' | 'ongoing';
  is_featured: boolean;
  max_tickets_per_order: number;
  min_price: number | null;
  categories: PublicEventCategory[];
  images: PublicEventImage[];
  tiers: PublicEventTier[];
  seller: PublicEventSeller;
  created_at: string;
  updated_at: string;
};

export type ReservationDetail = {
  id: string;
  user_id: string;
  ticket_tier_id: string;
  quantity: number;
  status: 'active' | 'converted' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
  remaining_seconds: number;
  event_id: string;
  event_slug: string;
  event_title: string;
  tier_name: string;
};

export type ReservationCreatePayload = {
  reservation_id: string;
  expires_at: string;
};

export type OrderItem = {
  id: string;
  ticket_tier_id: string;
  tier_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export type OrderPayment = {
  id: string;
  method: 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
  status: 'pending' | 'success' | 'failed' | 'refunded';
  amount: number;
  external_ref: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderListItem = {
  id: string;
  reservation_id: string | null;
  order_number: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  total_amount: number;
  event_id: string;
  event_slug: string;
  event_title: string;
  created_at: string;
  expires_at: string;
};

export type OrderDetail = {
  id: string;
  reservation_id: string | null;
  order_number: string;
  status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  total_amount: number;
  service_fee: number;
  expires_at: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  event_id: string;
  event_slug: string;
  event_title: string;
  items: OrderItem[];
  payment: OrderPayment;
  tickets: Array<{
    id: string;
    ticket_tier_id: string;
    ticket_code: string;
    status: 'valid' | 'used' | 'cancelled' | 'refunded';
    issued_at: string;
  }>;
};

export type BuyerTicketListItem = {
  id: string;
  order_id: string;
  order_number: string;
  ticket_tier_id: string;
  tier_name: string;
  ticket_code: string;
  status: 'valid' | 'used' | 'cancelled' | 'refunded';
  issued_at: string;
  event_id: string;
  event_slug: string;
  event_title: string;
  event_start_at: string;
  venue_name: string;
  venue_city: string;
};

export type BuyerTicketDetail = {
  id: string;
  order_id: string;
  order_number: string;
  ticket_tier_id: string;
  tier_name: string;
  ticket_code: string;
  qr_data: string;
  attendee_name: string | null;
  attendee_email: string | null;
  status: 'valid' | 'used' | 'cancelled' | 'refunded';
  issued_at: string;
  checked_in_at: string | null;
  event: {
    id: string;
    slug: string;
    title: string;
    banner_url: string | null;
    start_at: string;
    end_at: string;
    venue_name: string;
    venue_address: string | null;
    venue_city: string;
  };
};

export type InitiatePaymentPayload = {
  order_id: string;
  payment_id: string;
  method: 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
  status: 'pending' | 'success' | 'failed' | 'refunded';
  external_ref: string;
  payment_url: string | null;
};

export type PublicEventListResponse = {
  data: PublicEventListItem[];
  meta: PaginationMeta;
};

export type ApiEnvelope<T, TMeta = unknown> = {
  data: T;
  meta?: TMeta;
};

export type BuyerNotification = {
  id: string;
  type:
    | 'order_confirmed'
    | 'payment_reminder'
    | 'event_reminder'
    | 'new_order'
    | 'event_approved'
    | 'event_rejected'
    | 'info';
  title: string;
  body: string;
  is_read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type BuyerNotificationsPayload = {
  notifications: BuyerNotification[];
  unread_count: number;
};

export type EventQueryInput = {
  search?: string;
  category?: string;
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  priceMin?: string | number;
  priceMax?: string | number;
  page?: string | number;
  limit?: string | number;
};

export function buildEventQuery(input: EventQueryInput) {
  const params = new URLSearchParams();

  if (input.search) {
    params.set('search', input.search.trim());
  }

  if (input.category) {
    params.set('category', input.category.trim());
  }

  if (input.city) {
    params.set('city', input.city.trim());
  }

  if (input.dateFrom) {
    params.set('date_from', input.dateFrom);
  }

  if (input.dateTo) {
    params.set('date_to', input.dateTo);
  }

  if (input.priceMin !== undefined && input.priceMin !== '') {
    params.set('price_min', String(input.priceMin));
  }

  if (input.priceMax !== undefined && input.priceMax !== '') {
    params.set('price_max', String(input.priceMax));
  }

  if (input.page !== undefined && input.page !== '') {
    params.set('page', String(input.page));
  }

  if (input.limit !== undefined && input.limit !== '') {
    params.set('limit', String(input.limit));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

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
  const payload = await requestResponse<T>(method, path, options);
  return payload.data;
}

async function requestResponse<T, TMeta = unknown>(
  method: string,
  path: string,
  options: RequestOptions,
): Promise<ApiEnvelope<T, TMeta>> {
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
    body: body === undefined ? undefined : isFormDataBody(body) ? body : JSON.stringify(body),
  });

  if (response.status === 401 && requiresAuth && retryOnUnauthorized && cookies) {
    const refreshedAccessToken = await refreshSession(fetchFn, cookies);

    if (refreshedAccessToken) {
      return requestResponse<T, TMeta>(method, path, {
        ...options,
        retryOnUnauthorized: false,
      });
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

  return {
    data: payload.data,
    meta: payload.meta as TMeta | undefined,
  };
}

export function apiGet<T>(path: string, options: Omit<RequestOptions, 'body'>) {
  return request<T>('GET', path, options);
}

export function apiGetResponse<T, TMeta = unknown>(
  path: string,
  options: Omit<RequestOptions, 'body'>,
) {
  return requestResponse<T, TMeta>('GET', path, options);
}

export function apiPost<T>(path: string, body: unknown, options: Omit<RequestOptions, 'body'>) {
  return request<T>('POST', path, { ...options, body });
}

export function apiPatch<T>(path: string, body: unknown, options: Omit<RequestOptions, 'body'>) {
  return request<T>('PATCH', path, { ...options, body });
}

export function apiDelete<T>(path: string, options: Omit<RequestOptions, 'body'>) {
  return request<T>('DELETE', path, options);
}

export { ApiError };
