import { error, fail, redirect } from '@sveltejs/kit';

import {
  apiDelete,
  apiGet,
  apiPost,
  type OrderDetail,
  type PublicEventDetail,
  type ReservationCreatePayload,
  type ReservationDetail,
} from '$lib/api';
import { ApiError, clearAuthSession } from '$lib/auth';

function requireBuyerSession(locals: App.Locals) {
  if (!locals.buyerRefreshToken || locals.currentUser?.role !== 'buyer') {
    throw redirect(303, '/login');
  }
}

function normalizeQuantity(value: FormDataEntryValue | null) {
  const quantity = Number(value?.toString() ?? '1');

  if (!Number.isInteger(quantity) || quantity < 1) {
    return null;
  }

  return quantity;
}

export const load = (async ({ fetch, params, locals }) => {
  requireBuyerSession(locals);

  try {
    const event = await apiGet<PublicEventDetail>(`/events/${params.slug}`, {
      fetchFn: fetch,
      requiresAuth: false,
    });

    return {
      event,
      defaultTierId:
        event.tiers.find((tier) => tier.remaining > 0)?.id ?? event.tiers[0]?.id ?? null,
    };
  } catch (caughtError) {
    if (caughtError instanceof ApiError) {
      throw error(caughtError.status, caughtError.message);
    }

    throw error(500, 'Gagal memuat data checkout.');
  }
}) satisfies import('./$types').PageServerLoad;

export const actions = {
  reserve: async ({ request, fetch, cookies, locals }) => {
    requireBuyerSession(locals);

    const formData = await request.formData();
    const ticketTierId = formData.get('ticket_tier_id')?.toString() ?? '';
    const quantity = normalizeQuantity(formData.get('quantity'));

    if (!ticketTierId || quantity === null) {
      return fail(400, {
        reservationError: 'Tier tiket dan jumlah pembelian wajib diisi dengan benar.',
        selectedTierId: ticketTierId,
        quantity: formData.get('quantity')?.toString() ?? '1',
      });
    }

    try {
      const reservation = await apiPost<ReservationCreatePayload>(
        '/reservations',
        {
          ticket_tier_id: ticketTierId,
          quantity,
        },
        {
          fetchFn: fetch,
          cookies,
        },
      );

      return {
        reservation,
        reservationSuccess:
          'Reservasi berhasil dibuat. Lanjutkan ke pembayaran sebelum waktu habis.',
        selectedTierId: ticketTierId,
        quantity: String(quantity),
      };
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        clearAuthSession(cookies);
        throw redirect(303, '/login');
      }

      return fail(caughtError instanceof ApiError ? caughtError.status : 500, {
        reservationError:
          caughtError instanceof ApiError
            ? caughtError.code === 'SOLD_OUT'
              ? 'Tiket habis untuk tier yang dipilih.'
              : caughtError.message
            : 'Gagal membuat reservasi tiket.',
        selectedTierId: ticketTierId,
        quantity: String(quantity),
      });
    }
  },

  cancelReservation: async ({ request, fetch, cookies, locals }) => {
    requireBuyerSession(locals);

    const formData = await request.formData();
    const reservationId = formData.get('reservation_id')?.toString() ?? '';
    const selectedTierId = formData.get('selected_tier_id')?.toString() ?? '';
    const quantity = formData.get('quantity')?.toString() ?? '1';

    if (!reservationId) {
      return fail(400, {
        reservationError: 'Reservasi yang akan dibatalkan tidak valid.',
        selectedTierId,
        quantity,
      });
    }

    try {
      await apiDelete<{ reservation_id: string; status: 'cancelled' | 'expired' | 'converted' }>(
        `/reservations/${reservationId}`,
        {
          fetchFn: fetch,
          cookies,
        },
      );

      return {
        reservation: null,
        reservationSuccess: 'Reservasi berhasil dibatalkan.',
        selectedTierId,
        quantity,
      };
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        clearAuthSession(cookies);
        throw redirect(303, '/login');
      }

      return fail(caughtError instanceof ApiError ? caughtError.status : 500, {
        reservationError:
          caughtError instanceof ApiError ? caughtError.message : 'Gagal membatalkan reservasi.',
        selectedTierId,
        quantity,
      });
    }
  },

  createOrder: async ({ request, fetch, cookies, locals }) => {
    requireBuyerSession(locals);

    const formData = await request.formData();
    const reservationId = formData.get('reservation_id')?.toString() ?? '';
    const selectedTierId = formData.get('selected_tier_id')?.toString() ?? '';
    const quantity = formData.get('quantity')?.toString() ?? '1';

    if (!reservationId) {
      return fail(400, {
        reservationError: 'Buat reservasi terlebih dahulu sebelum melanjutkan ke pembayaran.',
        selectedTierId,
        quantity,
      });
    }

    let order: OrderDetail;

    try {
      order = await apiPost<OrderDetail>(
        '/orders',
        {
          reservation_id: reservationId,
        },
        {
          fetchFn: fetch,
          cookies,
        },
      );
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 401) {
        clearAuthSession(cookies);
        throw redirect(303, '/login');
      }

      const reservation = reservationId
        ? await apiGet<ReservationDetail>(`/reservations/${reservationId}`, {
            fetchFn: fetch,
            cookies,
          })
            .then((detail) => ({
              reservation_id: detail.id,
              expires_at: detail.expires_at,
            }))
            .catch(() => null)
        : null;

      return fail(caughtError instanceof ApiError ? caughtError.status : 500, {
        reservationError:
          caughtError instanceof ApiError
            ? caughtError.message
            : 'Gagal membuat order dari reservasi.',
        reservation,
        selectedTierId,
        quantity,
      });
    }

    throw redirect(303, `/payment/${order.id}`);
  },
} satisfies import('./$types').Actions;
