import { redirect } from '@sveltejs/kit';

import {
  API_BASE_URL,
  clearAuthSession,
  refreshSession,
  shouldRefreshAccessToken,
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

type ErrorResponse = {
  success: false;
  error?: {
    message?: string;
  };
};

async function parseJsonSafe<T>(response: Response) {
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return null;
  }

  return (await response.json()) as T;
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

export const load = (async ({ cookies, fetch, locals }) => {
  if (!locals.sellerRefreshToken || locals.currentUser?.role !== 'seller') {
    clearAuthSession(cookies);
    throw redirect(307, '/login');
  }

  let accessToken = shouldRefreshAccessToken(locals.sellerAccessToken)
    ? await refreshSession(fetch, cookies)
    : locals.sellerAccessToken;

  if (!accessToken) {
    throw redirect(307, '/login');
  }

  let dashboardResult = await fetchDashboard(fetch, accessToken);

  if (dashboardResult.response.status === 401) {
    const rotatedAccessToken = await refreshSession(fetch, cookies);

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
