import { ApiError, verifyEmail } from '$lib/auth';

export const load = (async ({ fetch, url }) => {
  const token = url.searchParams.get('token') ?? '';

  if (!token) {
    return {
      success: false,
      message: 'Token verifikasi email tidak ditemukan.',
    };
  }

  try {
    const result = await verifyEmail(fetch, token);

    return {
      success: true,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof ApiError ? error.message : 'Verifikasi email gagal.',
    };
  }
}) satisfies import('./$types').PageServerLoad;
