import { fail, redirect } from '@sveltejs/kit';

import { ApiError, register } from '$lib/auth';

export const actions = {
  default: async ({ request, fetch, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';
    const password = formData.get('password')?.toString() ?? '';
    const fullName = formData.get('full_name')?.toString().trim() ?? '';
    const phone = formData.get('phone')?.toString().trim() ?? '';

    if (!email || !password || !fullName) {
      return fail(400, {
        error: 'Email, password, dan nama lengkap wajib diisi.',
        values: {
          email,
          full_name: fullName,
          phone,
        },
      });
    }

    try {
      await register(fetch, cookies, {
        email,
        password,
        full_name: fullName,
        phone: phone || undefined,
      });
    } catch (error) {
      return fail(error instanceof ApiError ? error.status : 500, {
        error: error instanceof ApiError ? error.message : 'Registrasi buyer gagal.',
        values: {
          email,
          full_name: fullName,
          phone,
        },
      });
    }

    redirect(303, '/');
  },
} satisfies import('./$types').Actions;
