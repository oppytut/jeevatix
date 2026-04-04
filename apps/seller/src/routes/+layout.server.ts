import { redirect } from '@sveltejs/kit';

import { SELLER_REFRESH_TOKEN_COOKIE, SELLER_USER_COOKIE, parseStoredUserCookie } from '$lib/auth';

const AUTH_ROUTES = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

export const load = (({ cookies, url }) => {
  const pathname = url.pathname;
  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const refreshToken = cookies.get(SELLER_REFRESH_TOKEN_COOKIE);
  const currentUser = parseStoredUserCookie(cookies.get(SELLER_USER_COOKIE));
  const isSellerSession = Boolean(refreshToken && currentUser?.role === 'seller');

  if (!isAuthRoute && !isSellerSession) {
    redirect(307, '/login');
  }

  if (isAuthRoute && isSellerSession) {
    redirect(307, '/');
  }

  return {
    currentUser: isSellerSession ? currentUser : null,
  };
}) satisfies import('./$types').LayoutServerLoad;
