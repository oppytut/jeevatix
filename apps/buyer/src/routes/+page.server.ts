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
  try {
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
  } catch (error) {
    console.error('Homepage load error:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const emptyPaginationMeta = {
      total: 0,
      page: 1,
      limit: 8,
      totalPages: 0,
    };

    return {
      featuredEvents: [],
      categories: [],
      upcomingEvents: [],
      upcomingMeta: emptyPaginationMeta,
    };
  }
}) satisfies PageServerLoad;
