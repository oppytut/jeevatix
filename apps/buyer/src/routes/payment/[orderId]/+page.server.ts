import { error, fail, redirect } from '@sveltejs/kit';

import { apiGet, apiPost, type InitiatePaymentPayload, type OrderDetail } from '$lib/api';
import { ApiError, clearAuthSession } from '$lib/auth';

function requireBuyerSession(locals: App.Locals) {
  if (!locals.buyerRefreshToken || locals.currentUser?.role !== 'buyer') {
    throw redirect(303, '/login');
  }
}

export const load = (async ({ fetch, cookies, locals, params }) => {
  requireBuyerSession(locals);

  try {
    const order = await apiGet<OrderDetail>(`/orders/${params.orderId}`, {
      fetchFn: fetch,
      cookies,
    });

    return {
      order,
    };
  } catch (caughtError) {
    if (caughtError instanceof ApiError && caughtError.status === 401) {
      clearAuthSession(cookies);
      throw redirect(303, '/login');
    }

    throw error(
      caughtError instanceof ApiError ? caughtError.status : 500,
      caughtError instanceof ApiError ? caughtError.message : 'Gagal memuat detail pembayaran.',
    );
  }
}) satisfies import('./$types').PageServerLoad;

export const actions = {
  initiatePayment: async ({ request, fetch, cookies, locals, params }) => {
    requireBuyerSession(locals);

    const formData = await request.formData();
    const method = formData.get('method')?.toString() ?? '';

    if (!['bank_transfer', 'e_wallet', 'credit_card', 'virtual_account'].includes(method)) {
      return fail(400, {
        paymentError: 'Metode pembayaran yang dipilih tidak valid.',
        selectedMethod: method,
      });
    }

    let payment: InitiatePaymentPayload;

    try {
      payment = await apiPost<InitiatePaymentPayload>(
        `/payments/${params.orderId}/pay`,
        {
          method,
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

      return fail(caughtError instanceof ApiError ? caughtError.status : 500, {
        paymentError:
          caughtError instanceof ApiError ? caughtError.message : 'Gagal menginisiasi pembayaran.',
        selectedMethod: method,
      });
    }

    if (payment.payment_url) {
      throw redirect(303, payment.payment_url);
    }

    return {
      paymentSuccess: 'Pembayaran berhasil diproses.',
      selectedMethod: method,
    };
  },
} satisfies import('./$types').Actions;
