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
      sellerAccessToken: string | null;
      sellerRefreshToken: string | null;
      currentUser: import('$lib/auth').SellerAuthUser | null;
    }

    interface PageData {
      currentUser?: import('$lib/auth').SellerAuthUser | null;
    }
    // interface PageState {}
  }
}

export {};
