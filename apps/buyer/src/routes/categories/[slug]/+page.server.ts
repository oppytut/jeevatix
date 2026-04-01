import type { PageServerLoad } from './$types';

import { error } from '@sveltejs/kit';

import {
  apiGet,
  apiGetResponse,
  buildEventQuery,
  type PaginationMeta,
  type PublicCategory,
  type PublicEventListItem,
} from '$lib/api';
import { ApiError } from '$lib/auth';

function normalizePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

export const load = (async ({ fetch, params, url }) => {
  const page = normalizePositiveInt(url.searchParams.get('page'), 1);
  const limit = normalizePositiveInt(url.searchParams.get('limit'), 12);

  try {
    const [categories, categoryEvents] = await Promise.all([
      apiGet<PublicCategory[]>('/categories', {
        fetchFn: fetch,
        requiresAuth: false,
      }),
      apiGetResponse<PublicEventListItem[], PaginationMeta>(
        `/categories/${params.slug}/events${buildEventQuery({ page, limit })}`,
        {
          fetchFn: fetch,
          requiresAuth: false,
        },
      ),
    ]);

    const currentCategory = categories.find((category) => category.slug === params.slug);

    if (!currentCategory) {
      throw error(404, 'Kategori tidak ditemukan.');
    }

    return {
      currentCategory,
      categories,
      events: categoryEvents.data,
      meta: categoryEvents.meta,
    };
  } catch (cause) {
    if (
      typeof cause === 'object' &&
      cause !== null &&
      'status' in cause &&
      typeof cause.status === 'number'
    ) {
      throw cause;
    }

    if (cause instanceof ApiError) {
      throw error(cause.status, cause.message);
    }

    throw error(500, 'Gagal memuat kategori event.');
  }
}) satisfies PageServerLoad;