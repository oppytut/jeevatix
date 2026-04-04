import { fail, redirect } from '@sveltejs/kit';

import { apiGet, apiPatch, type BuyerNotification, type BuyerNotificationsPayload } from '$lib/api';
import { ApiError, clearAuthSession } from '$lib/auth';

function requireBuyerSession(locals: App.Locals) {
  if (!locals.buyerRefreshToken || locals.currentUser?.role !== 'buyer') {
    redirect(303, '/login');
  }
}

async function loadNotifications(fetchFn: typeof fetch, cookies: import('@sveltejs/kit').Cookies) {
  return apiGet<BuyerNotificationsPayload>('/notifications', {
    fetchFn,
    cookies,
  });
}

async function handleAuthFailure(error: unknown, cookies: import('@sveltejs/kit').Cookies) {
  if (error instanceof ApiError && error.status === 401) {
    clearAuthSession(cookies);
    redirect(303, '/login');
  }
}

export const load = (async ({ fetch, cookies, locals }) => {
  requireBuyerSession(locals);

  try {
    return await loadNotifications(fetch, cookies);
  } catch (error) {
    await handleAuthFailure(error, cookies);
    throw error;
  }
}) satisfies import('./$types').PageServerLoad;

export const actions = {
  markRead: async ({ request, fetch, cookies, locals }) => {
    requireBuyerSession(locals);

    const formData = await request.formData();
    const notificationId = formData.get('notification_id')?.toString() ?? '';

    if (!notificationId) {
      return fail(400, {
        notificationsError: 'Notifikasi yang dipilih tidak valid.',
      });
    }

    try {
      await apiPatch<BuyerNotification>(
        `/notifications/${notificationId}/read`,
        {},
        {
          fetchFn: fetch,
          cookies,
        },
      );

      const payload = await loadNotifications(fetch, cookies);

      return {
        ...payload,
      };
    } catch (error) {
      await handleAuthFailure(error, cookies);

      return fail(error instanceof ApiError ? error.status : 500, {
        notificationsError:
          error instanceof ApiError ? error.message : 'Gagal memperbarui status notifikasi.',
      });
    }
  },

  markAllRead: async ({ fetch, cookies, locals }) => {
    requireBuyerSession(locals);

    try {
      await apiPatch<{ message: string; unread_count: number }>(
        '/notifications/read-all',
        {},
        {
          fetchFn: fetch,
          cookies,
        },
      );

      const payload = await loadNotifications(fetch, cookies);

      return {
        ...payload,
        notificationsSuccess: 'Semua notifikasi sudah ditandai sebagai dibaca.',
      };
    } catch (error) {
      await handleAuthFailure(error, cookies);

      return fail(error instanceof ApiError ? error.status : 500, {
        notificationsError:
          error instanceof ApiError ? error.message : 'Gagal menandai semua notifikasi.',
      });
    }
  },
} satisfies import('./$types').Actions;
