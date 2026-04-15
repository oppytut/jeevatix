import { fail, redirect } from '@sveltejs/kit';

import { ApiError, registerSeller } from '$lib/auth';

export const actions = {
  default: async ({ request, fetch, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';
    const password = formData.get('password')?.toString() ?? '';
    const fullName = formData.get('full_name')?.toString().trim() ?? '';
    const phone = formData.get('phone')?.toString().trim() ?? '';
    const orgName = formData.get('org_name')?.toString().trim() ?? '';
    const orgDescription = formData.get('org_description')?.toString().trim() ?? '';

    if (!email || !password || !fullName || !orgName) {
      return fail(400, {
        error: 'Email, password, nama lengkap, dan nama organisasi wajib diisi.',
        values: {
          email,
          full_name: fullName,
          phone,
          org_name: orgName,
          org_description: orgDescription,
        },
      });
    }

    try {
      await registerSeller(fetch, cookies, {
        email,
        password,
        full_name: fullName,
        phone: phone || undefined,
        org_name: orgName,
        org_description: orgDescription || undefined,
      });
    } catch (error) {
      return fail(error instanceof ApiError ? error.status : 500, {
        error: error instanceof ApiError ? error.message : 'Registrasi seller gagal.',
        values: {
          email,
          full_name: fullName,
          phone,
          org_name: orgName,
          org_description: orgDescription,
        },
      });
    }

    redirect(303, '/');
  },
} satisfies import('./$types').Actions;
