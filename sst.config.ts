/// <reference path="./.sst/platform/config.d.ts" />

const configuredStage =
  process.env.SST_STAGE ?? process.env.STAGE ?? process.env.NODE_ENV ?? undefined;

$config({
  app(input) {
    return {
      name: 'jeevatix',
      home: 'cloudflare',
      stage: configuredStage ?? input?.stage,
    };
  },
  async run() {
    // Placeholder: Cloudflare Workers API app will be defined here.
    // Placeholder: Hyperdrive resource for PostgreSQL connection pooling will be defined here.
    // Placeholder: Durable Objects like TicketReserver will be defined here.
    // Placeholder: Queues for email and reservation cleanup will be defined here.

    return {};
  },
});