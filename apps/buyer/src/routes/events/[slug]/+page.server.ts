import type { PageServerLoad } from './$types';

import { error } from '@sveltejs/kit';

import { apiGet, type PublicEventDetail } from '$lib/api';
import { ApiError } from '$lib/auth';

export const load = (async ({ fetch, params }) => {
  try {
    const event = await apiGet<PublicEventDetail>(`/events/${params.slug}`, {
      fetchFn: fetch,
      requiresAuth: false,
    });

    return {
      event,
    };
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw error(cause.status, cause.message);
    }

    throw error(500, 'Gagal memuat detail event.');
  }
}) satisfies PageServerLoad;
