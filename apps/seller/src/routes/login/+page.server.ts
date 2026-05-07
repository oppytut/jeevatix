import { fail, redirect } from '@sveltejs/kit';

import { ApiError, login, API_BASE_URL } from '$lib/auth';
import { dev } from '$app/environment';

export const actions = {
  default: async ({ request, cookies }) => {
    const formData = await request.formData();
    const email = formData.get('email')?.toString().trim() ?? '';
    const password = formData.get('password')?.toString() ?? '';

    console.log('[Seller Login] Attempt:', {
      email: dev ? email : `${email.substring(0, 3)}***@***`,
      hasPassword: !!password,
      apiBaseUrl: API_BASE_URL,
    });

    if (!email || !password) {
      console.log('[Seller Login] Validation failed: missing email or password');
      return fail(400, {
        error: 'Email dan password wajib diisi.',
        values: { email },
      });
    }

    try {
      const fetchToUse =
        typeof globalThis !== 'undefined' && globalThis.fetch ? globalThis.fetch : fetch;
      console.log('[Seller Login] Calling login function...');
      const result = await login(fetchToUse, cookies, email, password);
      console.log('[Seller Login] Success:', { userId: result.user.id, role: result.user.role });
    } catch (error) {
      console.error('[Seller Login] Error:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        status: error instanceof ApiError ? error.status : undefined,
        code: error instanceof ApiError ? error.code : undefined,
      });

      const errorMessage =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? `Login gagal: ${error.message}`
            : 'Login gagal. Silakan coba lagi.';

      return fail(error instanceof ApiError ? error.status : 500, {
        error: errorMessage,
        values: { email },
      });
    }

    console.log('[Seller Login] Redirecting to dashboard...');
    redirect(303, '/');
  },
} satisfies import('./$types').Actions;
