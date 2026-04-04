import { error, redirect } from '@sveltejs/kit';

import { apiGetResponse, type OrderListItem, type PaginationMeta } from '$lib/api';
import { ApiError, clearAuthSession } from '$lib/auth';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

function requireBuyerSession(locals: App.Locals) {
  if (!locals.buyerRefreshToken || locals.currentUser?.role !== 'buyer') {
    throw redirect(303, '/login');
  }
}

function normalizePage(value: string | null) {
  const page = Number(value ?? String(DEFAULT_PAGE));

  if (!Number.isInteger(page) || page < 1) {
    return DEFAULT_PAGE;
  }

  return page;
}

export const load = (async ({ fetch, cookies, locals, url }) => {
  requireBuyerSession(locals);

  const page = normalizePage(url.searchParams.get('page'));

  try {
    const response = await apiGetResponse<OrderListItem[], PaginationMeta>(
      `/orders?page=${page}&limit=${DEFAULT_LIMIT}`,
      {
        fetchFn: fetch,
        cookies,
      },
    );

    return {
      orders: response.data,
      meta: response.meta ?? {
        total: 0,
        page,
        limit: DEFAULT_LIMIT,
        totalPages: 0,
      },
    };
  } catch (caughtError) {
    if (caughtError instanceof ApiError && caughtError.status === 401) {
      clearAuthSession(cookies);
      throw redirect(303, '/login');
    }

    throw error(
      caughtError instanceof ApiError ? caughtError.status : 500,
      caughtError instanceof ApiError ? caughtError.message : 'Gagal memuat riwayat order.',
    );
  }
}) satisfies import('./$types').PageServerLoad;
