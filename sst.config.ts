/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./.sst/platform/config.d.ts" />

const configuredStage =
  process.env.SST_STAGE ?? process.env.STAGE ?? process.env.NODE_ENV ?? undefined;

const cloudflareAccountId =
  process.env.CLOUDFLARE_DEFAULT_ACCOUNT_ID ?? process.env.CLOUDFLARE_ACCOUNT_ID;

function getStage() {
  if (configuredStage) {
    return configuredStage;
  }

  try {
    return $app.stage ?? 'development';
  } catch {
    return 'development';
  }
}

const apiCompatibilityDate = '2026-03-30';
const apiCompatibilityFlags = ['nodejs_compat', 'no_handle_cross_request_promise_resolution'];
const portalCompatibilityDate = '2026-03-30';
const portalCompatibilityFlags = ['nodejs_compat', 'nodejs_als'];

const productionDomains = {
  api: process.env.PRODUCTION_API_DOMAIN ?? 'api.jeevatix.com',
  buyer: process.env.PRODUCTION_BUYER_DOMAIN ?? 'jeevatix.com',
  admin: process.env.PRODUCTION_ADMIN_DOMAIN ?? 'admin.jeevatix.com',
  seller: process.env.PRODUCTION_SELLER_DOMAIN ?? 'seller.jeevatix.com',
};

const stagingDomains = {
  api: process.env.STAGING_API_DOMAIN ?? 'api.jeevatix.my.id',
  buyer: process.env.STAGING_BUYER_DOMAIN ?? 'jeevatix.my.id',
  admin: process.env.STAGING_ADMIN_DOMAIN ?? 'admin.jeevatix.my.id',
  seller: process.env.STAGING_SELLER_DOMAIN ?? 'seller.jeevatix.my.id',
};

const localPortalOrigins = [
  'http://localhost:4301',
  'http://localhost:4302',
  'http://localhost:4303',
];

type WorkerBinding = {
  name: string;
  type: string;
  className?: string;
  scriptName?: string;
};
type WorkerTransformArgs = cloudflare.WorkersScriptArgs;

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required to deploy the ${getStage()} stack.`);
  }

  return value;
}

function maybeEnv(name: string) {
  return process.env[name];
}

function shouldSkipDurableObjectMigrations() {
  return maybeEnv('SKIP_DURABLE_OBJECT_MIGRATIONS') === '1';
}

function isStagingStage() {
  return getStage() === 'staging';
}

function isProductionStage() {
  return getStage() === 'production';
}

function usesCustomDomains() {
  return isProductionStage() || isStagingStage();
}

function getDeployedDomains() {
  return isProductionStage() ? productionDomains : isStagingStage() ? stagingDomains : null;
}

function getQueueName() {
  return process.env.RESERVATION_CLEANUP_QUEUE_NAME ?? `jeevatix-${getStage()}-reservation-cleanup`;
}

function getBucketName() {
  return process.env.R2_BUCKET_NAME ??
    (isProductionStage() ? 'jeevatix-uploads' : `jeevatix-${getStage()}-uploads`);
}

function getApiScriptName() {
  return process.env.API_WORKER_NAME ?? `jeevatix-${getStage()}-api`;
}

function getReservationCleanupConsumerScriptName() {
  return (
    process.env.RESERVATION_CLEANUP_CONSUMER_WORKER_NAME ??
    `jeevatix-${getStage()}-reservation-cleanup-consumer`
  );
}

function getReservationCleanupCronScriptName() {
  return (
    process.env.RESERVATION_CLEANUP_CRON_WORKER_NAME ??
    `jeevatix-${getStage()}-reservation-cleanup-cron`
  );
}

function getBuyerScriptName() {
  return process.env.BUYER_WORKER_NAME ?? `jeevatix-${getStage()}-buyer`;
}

function getAdminScriptName() {
  return process.env.ADMIN_WORKER_NAME ?? `jeevatix-${getStage()}-admin`;
}

function getSellerScriptName() {
  return process.env.SELLER_WORKER_NAME ?? `jeevatix-${getStage()}-seller`;
}

function buildCorsAllowedOrigins() {
  const deployedDomains = getDeployedDomains();
  const origins = deployedDomains
    ? [
        `https://${deployedDomains.buyer}`,
        `https://${deployedDomains.admin}`,
        `https://${deployedDomains.seller}`,
      ]
    : localPortalOrigins;

  return origins.join(',');
}

function buildAppVersion() {
  return maybeEnv('APP_VERSION') ?? `local-${getStage()}`;
}

function setOptionalEnvironmentValue(
  environment: Record<string, string>,
  key: string,
  value: string | undefined,
) {
  if (value) {
    environment[key] = value;
  }
}

function createApiEnvironment() {
  const stage = getStage();
  const deployedDomains = getDeployedDomains();

  const environment: Record<string, string> = {
    APP_ENVIRONMENT: stage,
    APP_VERSION: buildAppVersion(),
    DATABASE_URL: requireEnv('DATABASE_URL'),
    DB_DISABLE_CACHE: '1',
    JWT_SECRET: requireEnv('JWT_SECRET'),
    PAYMENT_WEBHOOK_SECRET: requireEnv('PAYMENT_WEBHOOK_SECRET'),
    EMAIL_API_KEY: requireEnv('EMAIL_API_KEY'),
    EMAIL_FROM: requireEnv('EMAIL_FROM'),
    UPLOAD_PUBLIC_URL: requireEnv('UPLOAD_PUBLIC_URL'),
    CORS_ALLOWED_ORIGINS: maybeEnv('CORS_ALLOWED_ORIGINS') ?? buildCorsAllowedOrigins(),
  };

  setOptionalEnvironmentValue(
    environment,
    'BUYER_APP_URL',
    maybeEnv('BUYER_APP_URL') ??
      (deployedDomains ? `https://${deployedDomains.buyer}` : undefined),
  );
  setOptionalEnvironmentValue(
    environment,
    'SELLER_APP_URL',
    maybeEnv('SELLER_APP_URL') ??
      (deployedDomains ? `https://${deployedDomains.seller}` : undefined),
  );
  setOptionalEnvironmentValue(
    environment,
    'AUTH_EXPOSE_DEBUG_TOKENS',
    maybeEnv('AUTH_EXPOSE_DEBUG_TOKENS'),
  );
  setOptionalEnvironmentValue(environment, 'PARTY_SECRET', maybeEnv('PARTY_SECRET'));
  setOptionalEnvironmentValue(environment, 'PARTYKIT_HOST', maybeEnv('PARTYKIT_HOST'));
  setOptionalEnvironmentValue(
    environment,
    'TICKET_RESERVER_DATABASE_URL',
    maybeEnv('TICKET_RESERVER_DATABASE_URL'),
  );
  setOptionalEnvironmentValue(
    environment,
    'TICKET_RESERVER_DB_MAX_CONNECTIONS',
    maybeEnv('TICKET_RESERVER_DB_MAX_CONNECTIONS'),
  );

  return environment;
}

function createDurableObjectBindings(durableObjectScriptName?: string): WorkerBinding[] {
  return [
    {
      name: 'TICKET_RESERVER',
      type: 'durable_object_namespace',
      className: 'TicketReserver',
      ...(durableObjectScriptName ? { scriptName: durableObjectScriptName } : {}),
    },
    {
      name: 'RATE_LIMITER',
      type: 'durable_object_namespace',
      className: 'RateLimiter',
      ...(durableObjectScriptName ? { scriptName: durableObjectScriptName } : {}),
    },
  ];
}

function applyApiWorkerTransform(
  args: WorkerTransformArgs,
  options: {
    scriptName: string;
    durableObjectScriptName?: string;
    includeDurableObjects?: boolean;
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

  args.bindings = $output(args.bindings ?? []).apply((bindings: WorkerBinding[]) => [
    ...bindings,
    ...(options.includeDurableObjects === false
      ? []
      : createDurableObjectBindings(options.durableObjectScriptName)),
  ]);

  if (options.configureMigrations && !shouldSkipDurableObjectMigrations()) {
    args.migrations = {
      newTag: 'v2',
      steps: [
        {
          newSqliteClasses: ['TicketReserver'],
        },
        {
          newSqliteClasses: ['RateLimiter'],
        },
      ],
    };
  }
}

function applyPortalWorkerTransform(args: WorkerTransformArgs, scriptName: string) {
  args.scriptName = scriptName;
  args.compatibilityDate = portalCompatibilityDate;
  args.compatibilityFlags = portalCompatibilityFlags;
}

export default $config({
  app(input) {
    const stage = configuredStage ?? input?.stage ?? 'development';

    return {
      name: 'jeevatix',
      home: 'cloudflare',
      stage,
      protect: stage === 'production',
      removal: stage === 'production' ? 'retain' : 'remove',
    };
  },
  async run() {
    const apiEnvironment = createApiEnvironment();
    const deployedDomains = getDeployedDomains();
    const apiScriptName = getApiScriptName();
    const reservationCleanupConsumerScriptName = getReservationCleanupConsumerScriptName();
    const reservationCleanupCronScriptName = getReservationCleanupCronScriptName();
    const buyerScriptName = getBuyerScriptName();
    const adminScriptName = getAdminScriptName();
    const sellerScriptName = getSellerScriptName();
    const queueName = getQueueName();
    const bucketName = getBucketName();

    const uploadsBucket = new sst.cloudflare.Bucket('UploadsBucket', {
      transform: {
        bucket(args, opts) {
          args.name = bucketName;

          if (isStagingStage() && cloudflareAccountId) {
            opts.import = `${cloudflareAccountId}/${bucketName}/default`;
          }
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
      link: [uploadsBucket, reservationCleanupQueue],
      url: !usesCustomDomains(),
      domain: deployedDomains?.api,
      transform: {
        worker(args) {
          applyApiWorkerTransform(args, {
            scriptName: apiScriptName,
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
      {
        dependsOn: [api.nodes.worker],
      },
    );

    new sst.cloudflare.Cron('ReservationCleanupCron', {
      schedules: ['* * * * *'],
      worker: {
        handler: 'apps/api/src/index.ts',
        environment: apiEnvironment,
        link: [reservationCleanupQueue],
        transform: {
          worker(args) {
            applyApiWorkerTransform(args, {
              scriptName: reservationCleanupCronScriptName,
              includeDurableObjects: false,
              durableObjectScriptName: apiScriptName,
            });
          },
        },
      },
    }, {
      dependsOn: [api.nodes.worker],
    });

    const buyer = new sst.cloudflare.Worker('BuyerPortal', {
      handler: 'apps/buyer/.svelte-kit/cloudflare/_worker.js',
      assets: {
        directory: 'apps/buyer/.svelte-kit/cloudflare',
      },
      url: !usesCustomDomains(),
      domain: deployedDomains?.buyer,
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
      url: !usesCustomDomains(),
      domain: deployedDomains?.admin,
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
      url: !usesCustomDomains(),
      domain: deployedDomains?.seller,
      transform: {
        worker(args) {
          applyPortalWorkerTransform(args, sellerScriptName);
        },
      },
    });

    return {
      api: deployedDomains ? `https://${deployedDomains.api}` : api.url,
      buyer: deployedDomains ? `https://${deployedDomains.buyer}` : buyer.url,
      admin: deployedDomains ? `https://${deployedDomains.admin}` : admin.url,
      seller: deployedDomains ? `https://${deployedDomains.seller}` : seller.url,
      apiWorker: apiScriptName,
      uploadsBucket: uploadsBucket.name,
      reservationCleanupQueue: queueName,
    };
  },
});
