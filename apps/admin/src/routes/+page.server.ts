import { redirect } from '@sveltejs/kit';

import { clearAuthSession, refreshSession, shouldRefreshAccessToken } from '$lib/auth';
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
    status:
      | 'draft'
      | 'pending_review'
      | 'published'
      | 'rejected'
      | 'ongoing'
      | 'completed'
      | 'cancelled';
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

export const load = (async ({ cookies, fetch, locals }) => {
  if (!locals.adminRefreshToken || locals.currentUser?.role !== 'admin') {
    clearAuthSession(cookies);
    throw redirect(307, '/login');
  }

  let accessToken = shouldRefreshAccessToken(locals.adminAccessToken)
    ? await refreshSession(fetch, cookies)
    : locals.adminAccessToken;

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
