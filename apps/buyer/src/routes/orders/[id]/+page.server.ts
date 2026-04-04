import { error, redirect } from '@sveltejs/kit';

import { apiGet, type OrderDetail } from '$lib/api';
import { ApiError, clearAuthSession } from '$lib/auth';

function requireBuyerSession(locals: App.Locals) {
  if (!locals.buyerRefreshToken || locals.currentUser?.role !== 'buyer') {
    throw redirect(303, '/login');
  }
}

export const load = (async ({ fetch, cookies, locals, params }) => {
  requireBuyerSession(locals);

  try {
    const order = await apiGet<OrderDetail>(`/orders/${params.id}`, {
      fetchFn: fetch,
      cookies,
    });

    return { order };
  } catch (caughtError) {
    if (caughtError instanceof ApiError && caughtError.status === 401) {
      clearAuthSession(cookies);
      throw redirect(303, '/login');
    }

    throw error(
      caughtError instanceof ApiError ? caughtError.status : 500,
      caughtError instanceof ApiError ? caughtError.message : 'Gagal memuat detail order.',
    );
  }
}) satisfies import('./$types').PageServerLoad;
