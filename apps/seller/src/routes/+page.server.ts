import { redirect } from '@sveltejs/kit';

import {
  ACCESS_TOKEN_MAX_AGE,
  API_BASE_URL,
  REFRESH_TOKEN_MAX_AGE,
  SELLER_ACCESS_TOKEN_COOKIE,
  SELLER_REFRESH_TOKEN_COOKIE,
  SELLER_USER_COOKIE,
  USER_COOKIE_MAX_AGE,
  type SellerAuthUser,
} from '$lib/auth';

type SellerDashboard = {
  total_events: number;
  total_revenue: number;
  total_tickets_sold: number;
  upcoming_events: number;
  recent_orders: Array<{
    id: string;
    order_number: string;
    event_title: string;
    buyer_name: string;
    total_amount: number;
    status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
    created_at: string;
  }>;
  daily_sales: Array<{
    date: string;
    tickets_sold: number;
  }>;
};

type DashboardSuccessResponse = {
  success: true;
  data: SellerDashboard;
};

type AuthSuccessResponse = {
  success: true;
  data: {
    access_token: string;
    refresh_token: string;
    user: SellerAuthUser;
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

async function refreshSellerSession(
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

  if (!response.ok || !payload || payload.success === false) {
    cookies.delete(SELLER_ACCESS_TOKEN_COOKIE, { path: '/' });
    cookies.delete(SELLER_REFRESH_TOKEN_COOKIE, { path: '/' });
    cookies.delete(SELLER_USER_COOKIE, { path: '/' });

    return undefined;
  }

  cookies.set(
    SELLER_ACCESS_TOKEN_COOKIE,
    payload.data.access_token,
    getCookieOptions(ACCESS_TOKEN_MAX_AGE),
  );
  cookies.set(
    SELLER_REFRESH_TOKEN_COOKIE,
    payload.data.refresh_token,
    getCookieOptions(REFRESH_TOKEN_MAX_AGE),
  );
  cookies.set(
    SELLER_USER_COOKIE,
    JSON.stringify(payload.data.user),
    getCookieOptions(USER_COOKIE_MAX_AGE),
  );

  return payload.data.access_token;
}

async function fetchDashboard(fetch: typeof globalThis.fetch, accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/seller/dashboard`, {
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
    return 'Gagal memuat dashboard seller.';
  }

  return payload.error?.message ?? 'Gagal memuat dashboard seller.';
}

export const load = (async ({ cookies, fetch }) => {
  const refreshToken = cookies.get(SELLER_REFRESH_TOKEN_COOKIE);

  if (!refreshToken) {
    throw redirect(307, '/login');
  }

  let accessToken = cookies.get(SELLER_ACCESS_TOKEN_COOKIE) ?? undefined;

  if (!accessToken) {
    accessToken = await refreshSellerSession(fetch, refreshToken, cookies);
  }

  if (!accessToken) {
    throw redirect(307, '/login');
  }

  let dashboardResult = await fetchDashboard(fetch, accessToken);

  if (dashboardResult.response.status === 401) {
    const rotatedAccessToken = await refreshSellerSession(fetch, refreshToken, cookies);

    if (!rotatedAccessToken) {
      throw redirect(307, '/login');
    }

    dashboardResult = await fetchDashboard(fetch, rotatedAccessToken);
  }

  if (!dashboardResult.response.ok || !dashboardResult.payload || dashboardResult.payload.success === false) {
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