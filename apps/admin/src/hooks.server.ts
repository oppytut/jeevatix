import type { Handle } from '@sveltejs/kit';

import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  ADMIN_USER_COOKIE,
  parseStoredUserCookie,
} from '$lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.adminAccessToken = event.cookies.get(ADMIN_ACCESS_TOKEN_COOKIE) ?? null;
  event.locals.adminRefreshToken = event.cookies.get(ADMIN_REFRESH_TOKEN_COOKIE) ?? null;
  event.locals.currentUser = parseStoredUserCookie(event.cookies.get(ADMIN_USER_COOKIE));

  return resolve(event);
};
