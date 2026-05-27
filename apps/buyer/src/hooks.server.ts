import type { Handle } from '@sveltejs/kit';

import {
  BUYER_ACCESS_TOKEN_COOKIE,
  BUYER_REFRESH_TOKEN_COOKIE,
  BUYER_USER_COOKIE,
  parseStoredUserCookie,
} from '$lib/auth';
import { setApiBinding } from '$lib/api-binding';

export const handle: Handle = async ({ event, resolve }) => {
  setApiBinding(event.platform?.env?.API);

  event.locals.buyerAccessToken = event.cookies.get(BUYER_ACCESS_TOKEN_COOKIE) ?? null;
  event.locals.buyerRefreshToken = event.cookies.get(BUYER_REFRESH_TOKEN_COOKIE) ?? null;
  event.locals.currentUser = parseStoredUserCookie(event.cookies.get(BUYER_USER_COOKIE));

  return resolve(event);
};
