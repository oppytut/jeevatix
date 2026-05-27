import type { Handle } from '@sveltejs/kit';

import {
  BUYER_ACCESS_TOKEN_COOKIE,
  BUYER_REFRESH_TOKEN_COOKIE,
  BUYER_USER_COOKIE,
  parseStoredUserCookie,
} from '$lib/auth';
import { setApiBinding } from '$lib/api-binding';

export const handle: Handle = async ({ event, resolve }) => {
  const env = event.platform?.env;
  if (env) {
    const keys = Object.keys(env).filter(
      (k) => typeof (env as Record<string, unknown>)[k] === 'object',
    );
    console.log('[Service Binding Debug] env object keys:', keys);
  }
  setApiBinding(env?.Api);

  event.locals.buyerAccessToken = event.cookies.get(BUYER_ACCESS_TOKEN_COOKIE) ?? null;
  event.locals.buyerRefreshToken = event.cookies.get(BUYER_REFRESH_TOKEN_COOKIE) ?? null;
  event.locals.currentUser = parseStoredUserCookie(event.cookies.get(BUYER_USER_COOKIE));

  return resolve(event);
};
