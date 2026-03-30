import { redirect } from '@sveltejs/kit';

import { ADMIN_REFRESH_TOKEN_COOKIE, ADMIN_USER_COOKIE, parseStoredUserCookie } from '$lib/auth';

export const load = (({ cookies, url }) => {
  const pathname = url.pathname;
  const isLoginRoute = pathname === '/login';
  const refreshToken = cookies.get(ADMIN_REFRESH_TOKEN_COOKIE);
  const currentUser = parseStoredUserCookie(cookies.get(ADMIN_USER_COOKIE));
  const isAdminSession = Boolean(refreshToken && currentUser?.role === 'admin');

  if (!isLoginRoute && !isAdminSession) {
    redirect(307, '/login');
  }

  if (isLoginRoute && isAdminSession) {
    redirect(307, '/');
  }

  return {
    currentUser: isAdminSession ? currentUser : null,
  };
}) satisfies import('./$types').LayoutServerLoad;
