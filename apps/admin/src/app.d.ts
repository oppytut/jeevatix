// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
  namespace App {
    interface Platform {
      env: Env;
      ctx: ExecutionContext;
      caches: CacheStorage;
      cf?: IncomingRequestCfProperties;
    }

    // interface Error {}
    interface Locals {
      adminAccessToken: string | null;
      adminRefreshToken: string | null;
      currentUser: import('$lib/auth').AdminAuthUser | null;
    }

    interface PageData {
      currentUser?: import('$lib/auth').AdminAuthUser | null;
    }
    // interface PageState {}
  }
}

export {};
