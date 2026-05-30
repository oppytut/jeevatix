// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  interface Env {
    Api: { fetch: typeof globalThis.fetch };
    INTERNAL_API_URL?: string;
    PUBLIC_API_BASE_URL?: string;
    PUBLIC_PARTYKIT_HOST?: string;
    SENTRY_DSN?: string;
    APP_ENVIRONMENT?: string;
    APP_VERSION?: string;
  }

  namespace App {
    interface Platform {
      env: Env;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }

    // interface Error {}
    interface Locals {
      buyerAccessToken: string | null;
      buyerRefreshToken: string | null;
      currentUser: import('$lib/auth').BuyerAuthUser | null;
    }

    interface PageData {
      currentUser?: import('$lib/auth').BuyerAuthUser | null;
    }
    // interface PageState {}
  }
}

export {};
