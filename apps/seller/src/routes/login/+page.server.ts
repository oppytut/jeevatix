import { fail, redirect } from '@sveltejs/kit';

import {
  ACCESS_TOKEN_MAX_AGE,
  REFRESH_TOKEN_MAX_AGE,
  SELLER_ACCESS_TOKEN_COOKIE,
  SELLER_REFRESH_TOKEN_COOKIE,
  SELLER_USER_COOKIE,
  USER_COOKIE_MAX_AGE,
  ApiError,
  type SellerAuthUser,
} from '$lib/auth';

type AuthPayload = {
  access_token: string;
  refresh_token: string;
  user: SellerAuthUser;
};

type AuthResponse = {
  success: true;
  data: AuthPayload;
};

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

function setCookie(cookies: import('@sveltejs/kit').Cookies, name: string, value: string, maxAge: number) {
  cookies.set(name, value, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    secure: false,
    maxAge,
  });
}

function persistAuthSession(cookies: import('@sveltejs/kit').Cookies, payload: AuthPayload) {
  setCookie(cookies, SELLER_ACCESS_TOKEN_COOKIE, payload.access_token, ACCESS_TOKEN_MAX_AGE);
  setCookie(cookies, SELLER_REFRESH_TOKEN_COOKIE, payload.refresh_token, REFRESH_TOKEN_MAX_AGE);
  setCookie(cookies, SELLER_USER_COOKIE, JSON.stringify(payload.user), USER_COOKIE_MAX_AGE);
}

async function parseResponse(response: Response) {
  const payload = (await response.json()) as AuthResponse | ErrorResponse;

  if (!response.ok || !payload.success) {
    throw new ApiError(
      payload.success ? 'Request failed.' : payload.error.message,
      response.status,
      payload.success ? 'API_ERROR' : payload.error.code,
    );
  }

  return payload.data;
}

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
      const response = await fetch('http://localhost:8787/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = await parseResponse(response);

      if (payload.user.role !== 'seller') {
        throw new ApiError('Akun ini tidak memiliki akses seller.', 403, 'FORBIDDEN');
      }

      persistAuthSession(cookies, payload);
    } catch (error) {
      return fail(error instanceof ApiError ? error.status : 500, {
        error: error instanceof ApiError ? error.message : 'Login gagal. Silakan coba lagi.',
        values: { email },
      });
    }

    redirect(303, '/');
  },
} satisfies import('./$types').Actions;