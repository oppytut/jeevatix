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

const EVENT_QUERY_PAGE_LIMIT = 100;

function getEndOfDayTimestamp(value: string) {
  const date = new Date(value);
  date.setUTCHours(23, 59, 59, 999);
  return date.getTime();
}

function normalizePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function filterEvents(
  events: PublicEventListItem[],
  filters: {
    search: string;
    city: string;
    dateFrom: string;
    dateTo: string;
    priceMin: string;
    priceMax: string;
  },
) {
  return events.filter((event) => {
    const matchesSearch =
      !filters.search ||
      event.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      (event.description ?? '').toLowerCase().includes(filters.search.toLowerCase());

    const matchesCity =
      !filters.city || event.venue_city.toLowerCase() === filters.city.toLowerCase();

    const eventStart = new Date(event.start_at).getTime();
    const matchesDateFrom = !filters.dateFrom || eventStart >= new Date(filters.dateFrom).getTime();
    const matchesDateTo = !filters.dateTo || eventStart <= getEndOfDayTimestamp(filters.dateTo);

    const minPrice = event.min_price ?? 0;
    const matchesPriceMin = !filters.priceMin || minPrice >= Number(filters.priceMin);
    const matchesPriceMax = !filters.priceMax || minPrice <= Number(filters.priceMax);

    return (
      matchesSearch &&
      matchesCity &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesPriceMin &&
      matchesPriceMax
    );
  });
}

function paginateEvents(events: PublicEventListItem[], page: number, limit: number) {
  const total = events.length;
  const offset = (page - 1) * limit;

  return {
    data: events.slice(offset, offset + limit),
    meta: {
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    } satisfies PaginationMeta,
  };
}

async function fetchAllEventPages(
  fetchFn: typeof fetch,
  buildPath: (page: number, limit: number) => string,
) {
  const firstPage = await apiGetResponse<PublicEventListItem[], PaginationMeta>(
    buildPath(1, EVENT_QUERY_PAGE_LIMIT),
    {
      fetchFn,
      requiresAuth: false,
    },
  );

  const events = [...firstPage.data];
  const totalPages = firstPage.meta?.totalPages ?? (events.length === 0 ? 0 : 1);

  for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
    const nextPage = await apiGetResponse<PublicEventListItem[], PaginationMeta>(
      buildPath(currentPage, EVENT_QUERY_PAGE_LIMIT),
      {
        fetchFn,
        requiresAuth: false,
      },
    );

    events.push(...nextPage.data);
  }

  return events;
}

export const load = (async ({ fetch, url }) => {
  const search = url.searchParams.get('search')?.trim() ?? '';
  const selectedCategories = url.searchParams.getAll('category').filter(Boolean);
  const city = url.searchParams.get('city')?.trim() ?? '';
  const dateFrom = url.searchParams.get('date_from') ?? '';
  const dateTo = url.searchParams.get('date_to') ?? '';
  const priceMin = url.searchParams.get('price_min') ?? '';
  const priceMax = url.searchParams.get('price_max') ?? '';
  const page = normalizePositiveInt(url.searchParams.get('page'), 1);
  const limit = normalizePositiveInt(url.searchParams.get('limit'), 12);

  try {
    const [categories, allPublicEvents] = await Promise.all([
      apiGet<PublicCategory[]>('/categories', {
        fetchFn: fetch,
        requiresAuth: false,
      }),
      fetchAllEventPages(
        fetch,
        (pageNumber, pageSize) =>
          `/events${buildEventQuery({ limit: pageSize, page: pageNumber })}`,
      ),
    ]);

    let eventsResponse: { data: PublicEventListItem[]; meta: PaginationMeta };

    if (selectedCategories.length <= 1) {
      const response = await apiGetResponse<PublicEventListItem[], PaginationMeta>(
        `/events${buildEventQuery({
          search,
          category: selectedCategories[0] ?? '',
          city,
          dateFrom,
          dateTo,
          priceMin,
          priceMax,
          page,
          limit,
        })}`,
        {
          fetchFn: fetch,
          requiresAuth: false,
        },
      );

      eventsResponse = {
        data: response.data,
        meta: response.meta ?? {
          total: response.data.length,
          page,
          limit,
          totalPages: response.data.length === 0 ? 0 : 1,
        },
      };
    } else {
      const categoryResponses = await Promise.all(
        selectedCategories.map((slug) =>
          fetchAllEventPages(
            fetch,
            (pageNumber, pageSize) =>
              `/categories/${slug}/events${buildEventQuery({ limit: pageSize, page: pageNumber })}`,
          ),
        ),
      );

      const combined = Array.from(
        new Map(
          categoryResponses.flatMap((response) => response).map((event) => [event.id, event]),
        ).values(),
      ).sort(
        (left, right) => new Date(left.start_at).getTime() - new Date(right.start_at).getTime(),
      );

      eventsResponse = paginateEvents(
        filterEvents(combined, { search, city, dateFrom, dateTo, priceMin, priceMax }),
        page,
        limit,
      );
    }

    const cityOptions = Array.from(
      new Set(allPublicEvents.map((event) => event.venue_city).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right));

    const maxPrice = Math.max(500000, ...allPublicEvents.map((event) => event.min_price ?? 0));

    return {
      events: eventsResponse.data,
      meta: eventsResponse.meta,
      categories,
      cityOptions,
      filters: {
        search,
        categories: selectedCategories,
        city,
        dateFrom,
        dateTo,
        priceMin,
        priceMax,
        limit,
      },
      priceBounds: {
        min: 0,
        max: maxPrice,
      },
    };
  } catch (cause) {
    if (cause instanceof ApiError) {
      throw error(cause.status, cause.message);
    }

    throw error(500, 'Gagal memuat daftar event publik.');
  }
}) satisfies PageServerLoad;
