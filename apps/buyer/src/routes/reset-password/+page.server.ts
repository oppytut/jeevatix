import { fail } from '@sveltejs/kit';

import { ApiError, resetPassword } from '$lib/auth';

export const load = (({ url }) => {
  return {
    token: url.searchParams.get('token') ?? '',
  };
}) satisfies import('./$types').PageServerLoad;

export const actions = {
  default: async ({ request, fetch, url }) => {
    const formData = await request.formData();
    const password = formData.get('password')?.toString() ?? '';
    const confirmPassword = formData.get('confirm_password')?.toString() ?? '';
    const token = url.searchParams.get('token') ?? '';

    if (!token) {
      return fail(400, {
        error: 'Token reset password tidak ditemukan.',
      });
    }

    if (!password || !confirmPassword) {
      return fail(400, {
        error: 'Password baru dan konfirmasi wajib diisi.',
      });
    }

    if (password !== confirmPassword) {
      return fail(400, {
        error: 'Konfirmasi password harus sama dengan password baru.',
      });
    }

    try {
      const result = await resetPassword(fetch, token, password);

      return {
        success: true,
        message: result.message,
      };
    } catch (error) {
      return fail(error instanceof ApiError ? error.status : 500, {
        error: error instanceof ApiError ? error.message : 'Reset password gagal.',
      });
    }
  },
} satisfies import('./$types').Actions;