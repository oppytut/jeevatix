import type { PageServerLoad } from './$types';

import {
  apiGet,
  buildEventQuery,
  type PublicCategory,
  type PublicEventListItem,
  type PublicEventListResponse,
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
    apiGet<PublicEventListResponse>(`/events${buildEventQuery({ limit: 8, page: 1 })}`, {
      fetchFn: fetch,
      requiresAuth: false,
    }),
  ]);

  return {
    featuredEvents,
    categories,
    upcomingEvents: upcomingResponse.data,
    upcomingMeta: upcomingResponse.meta,
  };
}) satisfies PageServerLoad;