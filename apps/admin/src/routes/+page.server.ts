import { redirect } from '@sveltejs/kit';

import {
  ACCESS_TOKEN_MAX_AGE,
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  ADMIN_USER_COOKIE,
  REFRESH_TOKEN_MAX_AGE,
  USER_COOKIE_MAX_AGE,
  type AdminAuthUser,
} from '$lib/auth';
import { API_BASE_URL } from '$lib/http';

type AdminDashboard = {
  total_users: number;
  total_sellers: number;
  total_buyers: number;
  total_events: number;
  total_events_published: number;
  total_revenue: number;
  total_tickets_sold: number;
  daily_transactions: Array<{
    date: string;
    transaction_count: number;
  }>;
  recent_events: Array<{
    id: string;
    name: string;
    seller: string;
    status: 'draft' | 'pending_review' | 'published' | 'rejected' | 'ongoing' | 'completed' | 'cancelled';
    created_at: string;
  }>;
  recent_orders: Array<{
    id: string;
    order_number: string;
    buyer: string;
    total_amount: number;
    status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
    created_at: string;
  }>;
};

type DashboardSuccessResponse = {
  success: true;
  data: AdminDashboard;
};

type AuthSuccessResponse = {
  success: true;
  data: {
    access_token: string;
    refresh_token: string;
    user: AdminAuthUser;
  };
};

type ErrorResponse = {
  success: false;
  error?: {
    message?: string;
  };
};

function getCookieOptions(maxAge: number) {
  return {
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: false,
    maxAge,
  };
}

async function parseJsonSafe<T>(response: Response) {
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return null;
  }

  return (await response.json()) as T;
}

async function refreshAdminSession(
  fetch: typeof globalThis.fetch,
  refreshToken: string,
  cookies: Parameters<import('./$types').PageServerLoad>[0]['cookies'],
): Promise<string | undefined> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const payload = await parseJsonSafe<AuthSuccessResponse | ErrorResponse>(response);

  if (!response.ok || !payload || payload.success === false || payload.data.user.role !== 'admin') {
    cookies.delete(ADMIN_ACCESS_TOKEN_COOKIE, { path: '/' });
    cookies.delete(ADMIN_REFRESH_TOKEN_COOKIE, { path: '/' });
    cookies.delete(ADMIN_USER_COOKIE, { path: '/' });

    return undefined;
  }

  cookies.set(
    ADMIN_ACCESS_TOKEN_COOKIE,
    payload.data.access_token,
    getCookieOptions(ACCESS_TOKEN_MAX_AGE),
  );
  cookies.set(
    ADMIN_REFRESH_TOKEN_COOKIE,
    payload.data.refresh_token,
    getCookieOptions(REFRESH_TOKEN_MAX_AGE),
  );
  cookies.set(
    ADMIN_USER_COOKIE,
    JSON.stringify(payload.data.user),
    getCookieOptions(USER_COOKIE_MAX_AGE),
  );

  return payload.data.access_token;
}

async function fetchDashboard(fetch: typeof globalThis.fetch, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const payload = await parseJsonSafe<DashboardSuccessResponse | ErrorResponse>(response);

  return { response, payload };
}

function getErrorMessage(payload: DashboardSuccessResponse | ErrorResponse | null) {
  if (!payload || payload.success) {
    return 'Gagal memuat dashboard admin.';
  }

  return payload.error?.message ?? 'Gagal memuat dashboard admin.';
}

export const load = (async ({ cookies, fetch }) => {
  const refreshToken = cookies.get(ADMIN_REFRESH_TOKEN_COOKIE);

  if (!refreshToken) {
    throw redirect(307, '/login');
  }

  let accessToken = cookies.get(ADMIN_ACCESS_TOKEN_COOKIE) ?? undefined;

  if (!accessToken) {
    accessToken = await refreshAdminSession(fetch, refreshToken, cookies);
  }

  if (!accessToken) {
    throw redirect(307, '/login');
  }

  let dashboardResult = await fetchDashboard(fetch, accessToken);

  if (dashboardResult.response.status === 401) {
    const rotatedAccessToken = await refreshAdminSession(fetch, refreshToken, cookies);

    if (!rotatedAccessToken) {
      throw redirect(307, '/login');
    }

    dashboardResult = await fetchDashboard(fetch, rotatedAccessToken);
  }

  if (
    !dashboardResult.response.ok ||
    !dashboardResult.payload ||
    dashboardResult.payload.success === false
  ) {
    return {
      dashboard: null,
      loadError: getErrorMessage(dashboardResult.payload),
    };
  }

  return {
    dashboard: dashboardResult.payload.data,
    loadError: null,
  };
}) satisfies import('./$types').PageServerLoad;