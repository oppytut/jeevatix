import type { RequestHandler } from '@sveltejs/kit';

import { apiGetResponse, type PaginationMeta, type PublicEventListItem } from '$lib/api';

const PAGE_LIMIT = 100;

async function fetchAllPublishedEvents(fetchFn: typeof fetch): Promise<PublicEventListItem[]> {
  try {
    const firstPage = await apiGetResponse<PublicEventListItem[], PaginationMeta>(
      `/events?limit=${PAGE_LIMIT}&page=1`,
      {
        fetchFn,
        requiresAuth: false,
      },
    );

    const events = [...firstPage.data];
    const totalPages = firstPage.meta?.totalPages ?? (events.length === 0 ? 0 : 1);

    for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
      const nextPage = await apiGetResponse<PublicEventListItem[], PaginationMeta>(
        `/events?limit=${PAGE_LIMIT}&page=${currentPage}`,
        {
          fetchFn,
          requiresAuth: false,
        },
      );

      events.push(...nextPage.data);
    }

    return events.filter((event) => event.status === 'published' || event.status === 'ongoing');
  } catch {
    return [];
  }
}

function generateSitemapXml(baseUrl: string, events: PublicEventListItem[]): string {
  const urls: Array<{ loc: string; lastmod?: string }> = [{ loc: '/' }, { loc: '/events' }];

  for (const event of events) {
    urls.push({
      loc: `/events/${event.slug}`,
    });
  }

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const url of urls) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(baseUrl + url.loc)}</loc>\n`;
    if (url.lastmod) {
      xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
    }
    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: RequestHandler = async ({ request, fetch }) => {
  const baseUrl = new URL(request.url).origin;
  const events = await fetchAllPublishedEvents(fetch);

  const xml = generateSitemapXml(baseUrl, events);

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
