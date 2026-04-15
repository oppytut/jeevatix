/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />

const configuredStage =
  process.env.SST_STAGE ?? process.env.STAGE ?? process.env.NODE_ENV ?? undefined;

const stage = configuredStage ?? 'development';
const isProduction = stage === 'production';

const cloudflareAccountId =
  process.env.CLOUDFLARE_ACCOUNT_ID ?? process.env.CLOUDFLARE_DEFAULT_ACCOUNT_ID;

const apiCompatibilityDate = '2026-03-30';
const apiCompatibilityFlags = ['nodejs_compat', 'no_handle_cross_request_promise_resolution'];
const portalCompatibilityDate = '2026-03-30';
const portalCompatibilityFlags = ['nodejs_als'];

const productionDomains = {
  api: process.env.PRODUCTION_API_DOMAIN ?? 'api.jeevatix.com',
  buyer: process.env.PRODUCTION_BUYER_DOMAIN ?? 'jeevatix.com',
  admin: process.env.PRODUCTION_ADMIN_DOMAIN ?? 'admin.jeevatix.com',
  seller: process.env.PRODUCTION_SELLER_DOMAIN ?? 'seller.jeevatix.com',
};

const queueName =
  process.env.RESERVATION_CLEANUP_QUEUE_NAME ?? `jeevatix-${stage}-reservation-cleanup`;
const bucketName =
  process.env.R2_BUCKET_NAME ?? (isProduction ? 'jeevatix-uploads' : `jeevatix-${stage}-uploads`);
const apiScriptName = process.env.API_WORKER_NAME ?? `jeevatix-${stage}-api`;
const reservationCleanupConsumerScriptName =
  process.env.RESERVATION_CLEANUP_CONSUMER_WORKER_NAME ??
  `jeevatix-${stage}-reservation-cleanup-consumer`;
const reservationCleanupCronScriptName =
  process.env.RESERVATION_CLEANUP_CRON_WORKER_NAME ?? `jeevatix-${stage}-reservation-cleanup-cron`;
const buyerScriptName = process.env.BUYER_WORKER_NAME ?? `jeevatix-${stage}-buyer`;
const adminScriptName = process.env.ADMIN_WORKER_NAME ?? `jeevatix-${stage}-admin`;
const sellerScriptName = process.env.SELLER_WORKER_NAME ?? `jeevatix-${stage}-seller`;

const localPortalOrigins = [
  'http://localhost:4301',
  'http://localhost:4302',
  'http://localhost:4303',
];

type WorkerBinding = {
  name: string;
  type: string;
  className?: string;
  bucketName?: string;
  queueName?: string;
  scriptName?: string;
};

type WorkerTransformArgs = Record<string, unknown> & {
  bindings?: WorkerBinding[];
  scriptName?: string;
  compatibilityDate?: string;
  compatibilityFlags?: string[];
  observability?: {
    enabled: boolean;
    logs: {
      enabled: boolean;
      invocationLogs: boolean;
      destinations: string[];
      persist: boolean;
    };
  };
  migrations?: {
    oldTag?: string;
    newTag?: string;
    newClasses?: string[];
  };
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to deploy the ${stage} stack.`);
  }

  return value;
}

function maybeEnv(name: string) {
  return process.env[name];
}

function buildCorsAllowedOrigins() {
  const origins = isProduction
    ? [
        `https://${productionDomains.buyer}`,
        `https://${productionDomains.admin}`,
        `https://${productionDomains.seller}`,
      ]
    : localPortalOrigins;

  return origins.join(',');
}

function buildAppVersion() {
  return maybeEnv('APP_VERSION') ?? `local-${stage}`;
}

function createApiEnvironment() {
  return {
    APP_ENVIRONMENT: stage,
    APP_VERSION: buildAppVersion(),
    DATABASE_URL: requireEnv('DATABASE_URL'),
    JWT_SECRET: requireEnv('JWT_SECRET'),
    PAYMENT_WEBHOOK_SECRET: requireEnv('PAYMENT_WEBHOOK_SECRET'),
    EMAIL_API_KEY: requireEnv('EMAIL_API_KEY'),
    EMAIL_FROM: requireEnv('EMAIL_FROM'),
    UPLOAD_PUBLIC_URL: requireEnv('UPLOAD_PUBLIC_URL'),
    BUYER_APP_URL:
      maybeEnv('BUYER_APP_URL') ??
      (isProduction ? `https://${productionDomains.buyer}` : undefined),
    SELLER_APP_URL:
      maybeEnv('SELLER_APP_URL') ??
      (isProduction ? `https://${productionDomains.seller}` : undefined),
    CORS_ALLOWED_ORIGINS: maybeEnv('CORS_ALLOWED_ORIGINS') ?? buildCorsAllowedOrigins(),
    AUTH_EXPOSE_DEBUG_TOKENS: maybeEnv('AUTH_EXPOSE_DEBUG_TOKENS'),
    PARTY_SECRET: maybeEnv('PARTY_SECRET'),
    PARTYKIT_HOST: maybeEnv('PARTYKIT_HOST'),
    TICKET_RESERVER_DATABASE_URL: maybeEnv('TICKET_RESERVER_DATABASE_URL'),
    TICKET_RESERVER_DB_MAX_CONNECTIONS: maybeEnv('TICKET_RESERVER_DB_MAX_CONNECTIONS'),
  };
}

function applyApiWorkerTransform(
  args: WorkerTransformArgs,
  options: {
    scriptName: string;
    includeBucket?: boolean;
    includeQueue?: boolean;
    durableObjectScriptName?: string;
    configureMigrations?: boolean;
  },
) {
  args.scriptName = options.scriptName;
  args.compatibilityDate = apiCompatibilityDate;
  args.compatibilityFlags = apiCompatibilityFlags;
  args.observability = {
    enabled: true,
    logs: {
      enabled: true,
      invocationLogs: true,
      destinations: ['cloudflare'],
      persist: true,
    },
  };

  const bindings = [...(args.bindings ?? [])];

  if (options.includeBucket) {
    bindings.push({
      name: 'BUCKET',
      type: 'r2bucket',
      bucketName,
    });
  }

  if (options.includeQueue) {
    bindings.push({
      name: 'RESERVATION_CLEANUP_QUEUE',
      type: 'queue',
      queueName,
    });
  }

  bindings.push({
    name: 'TICKET_RESERVER',
    type: 'durableobjectnamespace',
    className: 'TicketReserver',
    ...(options.durableObjectScriptName ? { scriptName: options.durableObjectScriptName } : {}),
  });

  bindings.push({
    name: 'RATE_LIMITER',
    type: 'durableobjectnamespace',
    className: 'RateLimiter',
    ...(options.durableObjectScriptName ? { scriptName: options.durableObjectScriptName } : {}),
  });

  args.bindings = bindings;

  if (options.configureMigrations) {
    args.migrations = {
      oldTag: 'v1',
      newTag: 'v2',
      newClasses: ['RateLimiter'],
    };
  }
}

function applyPortalWorkerTransform(args: WorkerTransformArgs, scriptName: string) {
  args.scriptName = scriptName;
  args.compatibilityDate = portalCompatibilityDate;
  args.compatibilityFlags = portalCompatibilityFlags;
}

$config({
  app(input) {
    return {
      name: 'jeevatix',
      home: 'cloudflare',
      stage: configuredStage ?? input?.stage,
      protect: input?.stage === 'production',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      providers: cloudflareAccountId
        ? {
            cloudflare: {
              accountId: cloudflareAccountId,
            },
          }
        : undefined,
    };
  },
  async run() {
    const apiEnvironment = createApiEnvironment();

    const uploadsBucket = new sst.cloudflare.Bucket('UploadsBucket', {
      transform: {
        bucket(args) {
          args.name = bucketName;
        },
      },
    });

    const reservationCleanupQueue = new sst.cloudflare.Queue('ReservationCleanupQueue', {
      transform: {
        queue(args) {
          args.queueName = queueName;
        },
      },
    });

    const api = new sst.cloudflare.Worker('Api', {
      handler: 'apps/api/src/index.ts',
      environment: apiEnvironment,
      url: !isProduction,
      domain: isProduction ? productionDomains.api : undefined,
      transform: {
        worker(args) {
          applyApiWorkerTransform(args, {
            scriptName: apiScriptName,
            includeBucket: true,
            includeQueue: true,
            configureMigrations: true,
          });
        },
      },
    });

    reservationCleanupQueue.subscribe(
      {
        handler: 'apps/api/src/index.ts',
        environment: apiEnvironment,
        transform: {
          worker(args) {
            applyApiWorkerTransform(args, {
              scriptName: reservationCleanupConsumerScriptName,
              durableObjectScriptName: apiScriptName,
            });
          },
        },
      },
      {
        batch: {
          size: 10,
          window: '30 seconds',
        },
      },
    );

    new sst.cloudflare.Cron('ReservationCleanupCron', {
      schedules: ['* * * * *'],
      worker: {
        handler: 'apps/api/src/index.ts',
        environment: apiEnvironment,
        transform: {
          worker(args) {
            applyApiWorkerTransform(args, {
              scriptName: reservationCleanupCronScriptName,
              includeQueue: true,
              durableObjectScriptName: apiScriptName,
            });
          },
        },
      },
    });

    const buyer = new sst.cloudflare.Worker('BuyerPortal', {
      handler: 'apps/buyer/.svelte-kit/cloudflare/_worker.js',
      assets: {
        directory: 'apps/buyer/.svelte-kit/cloudflare',
      },
      url: !isProduction,
      domain: isProduction ? productionDomains.buyer : undefined,
      transform: {
        worker(args) {
          applyPortalWorkerTransform(args, buyerScriptName);
        },
      },
    });

    const admin = new sst.cloudflare.Worker('AdminPortal', {
      handler: 'apps/admin/.svelte-kit/cloudflare/_worker.js',
      assets: {
        directory: 'apps/admin/.svelte-kit/cloudflare',
      },
      url: !isProduction,
      domain: isProduction ? productionDomains.admin : undefined,
      transform: {
        worker(args) {
          applyPortalWorkerTransform(args, adminScriptName);
        },
      },
    });

    const seller = new sst.cloudflare.Worker('SellerPortal', {
      handler: 'apps/seller/.svelte-kit/cloudflare/_worker.js',
      assets: {
        directory: 'apps/seller/.svelte-kit/cloudflare',
      },
      url: !isProduction,
      domain: isProduction ? productionDomains.seller : undefined,
      transform: {
        worker(args) {
          applyPortalWorkerTransform(args, sellerScriptName);
        },
      },
    });

    return {
      api: isProduction ? `https://${productionDomains.api}` : api.url,
      buyer: isProduction ? `https://${productionDomains.buyer}` : buyer.url,
      admin: isProduction ? `https://${productionDomains.admin}` : admin.url,
      seller: isProduction ? `https://${productionDomains.seller}` : seller.url,
      apiWorker: apiScriptName,
      uploadsBucket: uploadsBucket.name,
      reservationCleanupQueue: queueName,
    };
  },
});
