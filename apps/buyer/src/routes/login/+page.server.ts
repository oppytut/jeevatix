import { fail, redirect } from '@sveltejs/kit';

import { ApiError, login } from '$lib/auth';

export const actions = {
  default: async ({ request, fetch, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';
    const password = formData.get('password')?.toString() ?? '';

    if (!email || !password) {
      return fail(400, {
        error: 'Email dan password wajib diisi.',
        values: { email },
      });
    }

    try {
      await login(fetch, cookies, email, password);
    } catch (error) {
      return fail(error instanceof ApiError ? error.status : 500, {
        error: error instanceof ApiError ? error.message : 'Login gagal. Silakan coba lagi.',
        values: { email },
      });
    }

    redirect(303, '/');
  },
} satisfies import('./$types').Actions;
