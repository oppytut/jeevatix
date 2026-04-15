import { redirect } from '@sveltejs/kit';

import { clearAuthSession } from '$lib/auth';

const AUTH_ROUTES = new Set(['/login', '/register', '/forgot-password', '/reset-password']);

export const load = (({ cookies, locals, url }) => {
  const pathname = url.pathname;
  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const currentUser = locals.currentUser;
  const isSellerSession = Boolean(locals.sellerRefreshToken && currentUser?.role === 'seller');

  if (locals.sellerRefreshToken && currentUser?.role !== 'seller') {
    clearAuthSession(cookies);
  }

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
