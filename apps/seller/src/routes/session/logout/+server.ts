import { json } from '@sveltejs/kit';

import { logoutSession } from '$lib/auth';

export const POST = async ({ cookies, fetch }) => {
  await logoutSession(fetch, cookies);

  return json(
    {
      success: true as const,
      data: {
        message: 'Logout successful.',
      },
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
};
