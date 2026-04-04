import { redirect } from '@sveltejs/kit';

const AUTH_ROUTES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]);

export const load = (({ locals, url }) => {
  const pathname = url.pathname;
  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const isBuyerSession = Boolean(locals.buyerRefreshToken && locals.currentUser?.role === 'buyer');

  if (isAuthRoute && isBuyerSession) {
    redirect(307, '/');
  }

  return {
    currentUser: isBuyerSession ? locals.currentUser : null,
  };
}) satisfies import('./$types').LayoutServerLoad;
