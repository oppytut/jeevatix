import { json } from '@sveltejs/kit';

import { clearAuthSession, refreshSession, shouldRefreshAccessToken } from '$lib/auth';

function unauthorized() {
  return json(
    {
      success: false as const,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required.',
      },
    },
    {
      status: 401,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

async function readForceRefresh(request: Request) {
  try {
    const payload = (await request.json()) as { forceRefresh?: unknown };
    return payload.forceRefresh === true;
  } catch {
    return false;
  }
}

export const POST = async ({ request, cookies, fetch, locals }) => {
  const forceRefresh = await readForceRefresh(request);

  if (!locals.adminRefreshToken || locals.currentUser?.role !== 'admin') {
    clearAuthSession(cookies);
    return unauthorized();
  }

  const accessToken =
    forceRefresh || shouldRefreshAccessToken(locals.adminAccessToken)
      ? await refreshSession(fetch, cookies)
      : locals.adminAccessToken;

  if (!accessToken) {
    clearAuthSession(cookies);
    return unauthorized();
  }

  return json(
    {
      success: true as const,
      data: {
        access_token: accessToken,
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
};
