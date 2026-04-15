import type { Handle } from '@sveltejs/kit';

import {
  SELLER_ACCESS_TOKEN_COOKIE,
  SELLER_REFRESH_TOKEN_COOKIE,
  SELLER_USER_COOKIE,
  parseStoredUserCookie,
} from '$lib/auth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.sellerAccessToken = event.cookies.get(SELLER_ACCESS_TOKEN_COOKIE) ?? null;
  event.locals.sellerRefreshToken = event.cookies.get(SELLER_REFRESH_TOKEN_COOKIE) ?? null;
  event.locals.currentUser = parseStoredUserCookie(event.cookies.get(SELLER_USER_COOKIE));

  return resolve(event);
};
