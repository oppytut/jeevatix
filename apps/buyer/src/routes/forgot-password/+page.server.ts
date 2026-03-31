import { fail } from '@sveltejs/kit';

import { ApiError, forgotPassword } from '$lib/auth';

export const actions = {
  default: async ({ request, fetch }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';

    if (!email) {
      return fail(400, {
        error: 'Email wajib diisi.',
        values: { email },
      });
    }

    try {
      const result = await forgotPassword(fetch, email);

      return {
        success: true,
        message: result.message,
        resetToken: result.reset_token ?? null,
        values: { email },
      };
    } catch (error) {
      return fail(error instanceof ApiError ? error.status : 500, {
        error: error instanceof ApiError ? error.message : 'Gagal membuat token reset password.',
        values: { email },
      });
    }
  },
} satisfies import('./$types').Actions;