import type { PageServerLoad } from './$types';

import {
  apiGet,
  apiGetResponse,
  buildEventQuery,
  type PublicCategory,
  type PublicEventListItem,
  type PaginationMeta,
} from '$lib/api';

export const load = (async ({ fetch }) => {
  const [featuredEvents, categories, upcomingResponse] = await Promise.all([
    apiGet<PublicEventListItem[]>('/events/featured', {
      fetchFn: fetch,
      requiresAuth: false,
    }),
    apiGet<PublicCategory[]>('/categories', {
      fetchFn: fetch,
      requiresAuth: false,
    }),
    apiGetResponse<PublicEventListItem[], PaginationMeta>(
      `/events${buildEventQuery({ limit: 8, page: 1 })}`,
      {
        fetchFn: fetch,
        requiresAuth: false,
      },
    ),
  ]);

  return {
    featuredEvents,
    categories,
    upcomingEvents: upcomingResponse.data,
    upcomingMeta: upcomingResponse.meta ?? {
      total: upcomingResponse.data.length,
      page: 1,
      limit: upcomingResponse.data.length,
      totalPages: upcomingResponse.data.length === 0 ? 0 : 1,
    },
  };
}) satisfies PageServerLoad;
