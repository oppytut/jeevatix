import { redirect } from '@sveltejs/kit';

import { clearAuthSession } from '$lib/auth';

export const load = (({ cookies, locals, url }) => {
  const pathname = url.pathname;
  const isLoginRoute = pathname === '/login';
  const currentUser = locals.currentUser;
  const isAdminSession = Boolean(locals.adminRefreshToken && currentUser?.role === 'admin');

  if (locals.adminRefreshToken && currentUser?.role !== 'admin') {
    clearAuthSession(cookies);
  }

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
