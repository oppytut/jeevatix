import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { app } from '../apps/api/src/index';
import {
  LOAD_TEST_CLIENT_START_HEADER,
  LOAD_TEST_PROFILE_HEADER,
  LOAD_TEST_PROFILE_SEQUENCE_HEADER,
} from '../apps/api/src/lib/load-test-profile';
import { TicketReserver } from '../apps/api/src/durable-objects/ticket-reserver';

const currentDir = dirname(fileURLToPath(import.meta.url));
const envFilePath = resolve(currentDir, '../.env');

function loadDotEnv(path: string) {
  const fileContents = readFileSync(path, 'utf8');

  for (const line of fileContents.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['"]|['"]$/gu, '');
    process.env[key] = normalizedValue;
  }
}

loadDotEnv(envFilePath);

type TimedStep = {
  step: string;
  durationMs: number;
};

type LocalRunnerPresetName = 'load-baseline' | 'load-balanced' | 'load-fullflow';

type LocalRunnerPreset = {
  appDbMaxConnections: string;
  ticketReserverDbMaxConnections: string;
  paymentBackgroundTaskConcurrency: string;
};

type RequestCategory = 'reservation' | 'order' | 'payment' | 'paymentWebhook' | 'other';

type RequestCategoryCounts = Record<RequestCategory, number>;

const localRunnerPresets: Record<LocalRunnerPresetName, LocalRunnerPreset> = {
  'load-baseline': {
    appDbMaxConnections: '50',
    ticketReserverDbMaxConnections: '25',
    paymentBackgroundTaskConcurrency: '8',
  },
  'load-balanced': {
    appDbMaxConnections: '52',
    ticketReserverDbMaxConnections: '25',
    paymentBackgroundTaskConcurrency: '8',
  },
  'load-fullflow': {
    appDbMaxConnections: '55',
    ticketReserverDbMaxConnections: '25',
    paymentBackgroundTaskConcurrency: '8',
  },
};

function parseRunnerPresetArg(argv: string[]) {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === '--preset') {
      return argv[index + 1];
    }

    if (value?.startsWith('--preset=')) {
      return value.slice('--preset='.length);
    }
  }

  return undefined;
}

function isLocalRunnerPresetName(value: string | undefined): value is LocalRunnerPresetName {
  return Boolean(value && value in localRunnerPresets);
}

function getRequestedRunnerPreset() {
  const rawValue = parseRunnerPresetArg(process.argv.slice(2)) ?? process.env.LOAD_TEST_RUNNER_PRESET;

  if (!rawValue) {
    return undefined;
  }

  if (!isLocalRunnerPresetName(rawValue)) {
    throw new Error(
      `Unknown local runner preset \"${rawValue}\". Expected one of: ${Object.keys(localRunnerPresets).join(', ')}`,
    );
  }

  return rawValue;
}

function applyLocalRunnerPreset() {
  const presetName = getRequestedRunnerPreset();

  if (!presetName) {
    return undefined;
  }

  const preset = localRunnerPresets[presetName];

  process.env.DB_MAX_CONNECTIONS = preset.appDbMaxConnections;
  process.env.TICKET_RESERVER_DB_MAX_CONNECTIONS = preset.ticketReserverDbMaxConnections;
  process.env.PAYMENT_BACKGROUND_TASK_CONCURRENCY = preset.paymentBackgroundTaskConcurrency;

  return {
    presetName,
    preset,
  };
}

const appliedLocalRunnerPreset = applyLocalRunnerPreset();

process.env.JWT_SECRET ||= 'local-load-test-jwt-secret';
process.env.PAYMENT_WEBHOOK_SECRET ||= 'local-load-test-webhook-secret';

function shouldProfileLoadTests() {
  return process.env.LOAD_TEST_PROFILE === '1';
}

function shouldProfileRunner() {
  return process.env.LOAD_TEST_PROFILE === '1' || process.env.LOAD_TEST_PROFILE_RUNNER === '1';
}

function createRequestCategoryCounts(): RequestCategoryCounts {
  return {
    reservation: 0,
    order: 0,
    payment: 0,
    paymentWebhook: 0,
    other: 0,
  };
}

function categorizeRequest(method: string | undefined, pathname: string): RequestCategory {
  if (method === 'POST' && pathname === '/reservations') {
    return 'reservation';
  }

  if (method === 'POST' && pathname === '/orders') {
    return 'order';
  }

  if (method === 'POST' && pathname.startsWith('/payments/') && pathname.endsWith('/pay')) {
    return 'payment';
  }

  if (method === 'POST' && pathname === '/webhooks/payment') {
    return 'paymentWebhook';
  }

  return 'other';
}

function getRunnerProfileSampleEvery() {
  const rawValue = Number.parseInt(process.env.LOAD_TEST_PROFILE_RUNNER_SAMPLE_EVERY ?? '1', 10);

  if (Number.isFinite(rawValue) && rawValue > 1) {
    return Math.trunc(rawValue);
  }

  return 1;
}

function logTimedSteps(scope: string, details: Record<string, unknown>, steps: TimedStep[]) {
  if (!shouldProfileRunner()) {
    return;
  }

  console.log(
    `[load-profile] ${scope}`,
    JSON.stringify({
      ...details,
      steps,
    }),
  );
}

function logRuntimeSnapshot(scope: string, details: Record<string, unknown>) {
  if (!shouldProfileRunner()) {
    return;
  }

  console.log(`[load-profile] ${scope}`, JSON.stringify(details));
}

function roundMetric(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(value * 100) / 100;
}

function toMilliseconds(value: number) {
  return roundMetric(value / 1_000_000);
}

function parseClientStartTimestamp(rawValue: string | string[] | undefined) {
  const parsedValue = Number.parseInt(Array.isArray(rawValue) ? rawValue[0] ?? '' : rawValue ?? '', 10);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return undefined;
}

function buildTicketReserverDatabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) {
    return undefined;
  }

  const url = new URL(databaseUrl);
  url.searchParams.set('application_name', 'jeevatix-ticket-reserver-local');
  return url.toString();
}

function buildTicketReserverPoolSize() {
  const rawValue = Number.parseInt(process.env.DB_MAX_CONNECTIONS ?? '', 10);

  if (!Number.isFinite(rawValue) || rawValue <= 1) {
    return undefined;
  }

  return String(Math.max(1, Math.floor(rawValue / 2)));
}

type WaitUntilPromise = Promise<unknown>;

class LocalExecutionContext {
  private readonly pending = new Set<WaitUntilPromise>();

  waitUntil(promise: WaitUntilPromise) {
    this.pending.add(promise);
    promise.finally(() => this.pending.delete(promise));
  }

  passThroughOnException() {}
}

class LocalDurableObjectState {
  private queue = Promise.resolve();

  blockConcurrencyWhile<T>(closure: () => Promise<T>) {
    const result = this.queue.then(closure, closure);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }
}

class LocalDurableObjectStub {
  constructor(private readonly object: TicketReserver) {}

  fetch(input: Request | URL | string, init?: RequestInit) {
    const request = input instanceof Request ? input : new Request(input, init);

    return this.object.fetch(request);
  }
}

class LocalDurableObjectNamespace {
  private readonly instances = new Map<string, LocalDurableObjectStub>();

  constructor(
    private readonly env: Record<string, unknown>,
    private readonly DurableObjectClass: typeof TicketReserver,
  ) {}

  idFromName(name: string) {
    return name;
  }

  get(id: string) {
    const existing = this.instances.get(id);

    if (existing) {
      return existing;
    }

    const state = new LocalDurableObjectState();
    const object = new this.DurableObjectClass(state, this.env as never);
    const stub = new LocalDurableObjectStub(object);
    this.instances.set(id, stub);

    return stub;
  }
}

function readRequestBody(request: import('node:http').IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

const port = Number.parseInt(process.env.PORT ?? '8787', 10);
const env: Record<string, unknown> = {
  DATABASE_URL: process.env.DATABASE_URL,
  TICKET_RESERVER_DATABASE_URL: buildTicketReserverDatabaseUrl(process.env.DATABASE_URL),
  TICKET_RESERVER_DB_MAX_CONNECTIONS:
    process.env.TICKET_RESERVER_DB_MAX_CONNECTIONS ?? buildTicketReserverPoolSize(),
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
  EMAIL_API_KEY: process.env.EMAIL_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  PARTYKIT_HOST: process.env.PARTYKIT_HOST,
  PARTY_SECRET: process.env.PARTY_SECRET,
};

env.TICKET_RESERVER = new LocalDurableObjectNamespace(env, TicketReserver);

let inFlightRequestCount = 0;
let reservationRequestCount = 0;
const inFlightRequestsByCategory = createRequestCategoryCounts();
const seenRequestsByCategory = createRequestCategoryCounts();
let activeSocketCount = 0;
let acceptedSocketCount = 0;
let closedSocketCount = 0;
const socketAcceptedAt = new WeakMap<import('node:net').Socket, number>();
const eventLoopDelayMonitor = monitorEventLoopDelay({ resolution: 20 });
let previousEventLoopUtilization = performance.eventLoopUtilization();

eventLoopDelayMonitor.enable();

if (shouldProfileRunner()) {
  const runtimeSnapshotInterval = setInterval(() => {
    const currentEventLoopUtilization = performance.eventLoopUtilization();
    const delta = performance.eventLoopUtilization(previousEventLoopUtilization);

    previousEventLoopUtilization = currentEventLoopUtilization;

    logRuntimeSnapshot('localRunner.runtime', {
      inFlightRequests: inFlightRequestCount,
      reservationRequestsSeen: reservationRequestCount,
      inFlightByCategory: { ...inFlightRequestsByCategory },
      seenByCategory: { ...seenRequestsByCategory },
      activeSockets: activeSocketCount,
      acceptedSockets: acceptedSocketCount,
      closedSockets: closedSocketCount,
      eventLoopUtilizationPercent: roundMetric(delta.utilization * 100),
      eventLoopDelayMeanMs: toMilliseconds(eventLoopDelayMonitor.mean),
      eventLoopDelayP95Ms: toMilliseconds(eventLoopDelayMonitor.percentile(95)),
      eventLoopDelayP99Ms: toMilliseconds(eventLoopDelayMonitor.percentile(99)),
      eventLoopDelayMaxMs: toMilliseconds(eventLoopDelayMonitor.max),
    });

    eventLoopDelayMonitor.reset();
  }, 1_000);

  runtimeSnapshotInterval.unref();
}

const server = createServer(async (nodeRequest, nodeResponse) => {
  const requestStartedAt = Date.now();
  let requestCategory: RequestCategory = 'other';
  let didIncrementInFlight = false;

  try {
    const origin = `http://${nodeRequest.headers.host ?? `localhost:${port}`}`;
    const url = new URL(nodeRequest.url ?? '/', origin);
    requestCategory = categorizeRequest(nodeRequest.method, url.pathname);
    inFlightRequestCount += 1;
    inFlightRequestsByCategory[requestCategory] += 1;
    seenRequestsByCategory[requestCategory] += 1;
    didIncrementInFlight = true;

    const isReservationRequest = url.pathname.startsWith('/reservations');
    const requestSequence = isReservationRequest ? ++reservationRequestCount : 0;
    const shouldProfile =
      isReservationRequest &&
      shouldProfileRunner() &&
      requestSequence % getRunnerProfileSampleEvery() === 0;
    const steps: TimedStep[] = [];
    const inFlightByCategoryAtStart = shouldProfile ? { ...inFlightRequestsByCategory } : undefined;
    const acceptedAt = nodeRequest.socket ? socketAcceptedAt.get(nodeRequest.socket) : undefined;
    const clientStartedAt = shouldProfile
      ? parseClientStartTimestamp(nodeRequest.headers[LOAD_TEST_CLIENT_START_HEADER])
      : undefined;

    if (shouldProfile && clientStartedAt) {
      steps.push({
        step: 'client_send_to_handler',
        durationMs: Math.max(0, requestStartedAt - clientStartedAt),
      });
    }

    if (shouldProfile && acceptedAt) {
      steps.push({
        step: 'socket_accept_to_handler',
        durationMs: Math.max(0, requestStartedAt - acceptedAt),
      });
    }

    const requestBodyStartedAt = shouldProfile ? Date.now() : 0;
    const body =
      nodeRequest.method === 'GET' || nodeRequest.method === 'HEAD'
        ? undefined
        : await readRequestBody(nodeRequest);

    if (shouldProfile) {
      steps.push({
        step: 'read_request_body',
        durationMs: Date.now() - requestBodyStartedAt,
      });
    }

    const requestBuildStartedAt = shouldProfile ? Date.now() : 0;
    const requestHeaders = new Headers(nodeRequest.headers as Record<string, string>);

    if (shouldProfile) {
      requestHeaders.set(LOAD_TEST_PROFILE_HEADER, '1');
      requestHeaders.set(LOAD_TEST_PROFILE_SEQUENCE_HEADER, String(requestSequence));
    }

    const request = new Request(url, {
      method: nodeRequest.method,
      headers: requestHeaders,
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    if (shouldProfile) {
      steps.push({
        step: 'build_request',
        durationMs: Date.now() - requestBuildStartedAt,
      });
    }

    const ctx = new LocalExecutionContext();
    const appFetchStartedAt = shouldProfile ? Date.now() : 0;
    const response = await app.fetch(request, env as never, ctx as never);

    if (shouldProfile) {
      steps.push({
        step: 'app_fetch',
        durationMs: Date.now() - appFetchStartedAt,
      });
    }

    const writeResponseStartedAt = shouldProfile ? Date.now() : 0;
    const headers = Object.fromEntries(response.headers.entries());

    nodeResponse.writeHead(response.status, headers);

    if (response.body) {
      const bodyBuffer = Buffer.from(await response.arrayBuffer());
      nodeResponse.end(bodyBuffer);

      if (shouldProfile) {
        steps.push({
          step: 'write_response',
          durationMs: Date.now() - writeResponseStartedAt,
        });
        logTimedSteps(
          'localRunner.request',
          {
            method: nodeRequest.method,
            path: url.pathname,
            requestCategory,
            requestSequence,
            status: response.status,
            inFlightAtStart: inFlightRequestCount,
            activeSocketsAtStart: activeSocketCount,
            inFlightByCategoryAtStart,
            totalDurationMs: Date.now() - requestStartedAt,
          },
          steps,
        );
      }

      return;
    }

    nodeResponse.end();

    if (shouldProfile) {
      steps.push({
        step: 'write_response',
        durationMs: Date.now() - writeResponseStartedAt,
      });
      logTimedSteps(
        'localRunner.request',
        {
          method: nodeRequest.method,
          path: url.pathname,
          requestCategory,
          requestSequence,
          status: response.status,
          inFlightAtStart: inFlightRequestCount,
          activeSocketsAtStart: activeSocketCount,
          inFlightByCategoryAtStart,
          totalDurationMs: Date.now() - requestStartedAt,
        },
        steps,
      );
    }
  } catch (error) {
    console.error('Local API runner failed to handle request.', error);
    nodeResponse.writeHead(500, { 'content-type': 'application/json' });
    nodeResponse.end(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error occurred.' },
      }),
    );
  } finally {
    if (didIncrementInFlight) {
      inFlightRequestCount = Math.max(0, inFlightRequestCount - 1);
      inFlightRequestsByCategory[requestCategory] = Math.max(
        0,
        inFlightRequestsByCategory[requestCategory] - 1,
      );
    }
  }
});

server.on('connection', (socket) => {
  acceptedSocketCount += 1;
  activeSocketCount += 1;
  socketAcceptedAt.set(socket, Date.now());

  socket.on('close', () => {
    activeSocketCount = Math.max(0, activeSocketCount - 1);
    closedSocketCount += 1;
  });
});

server.listen(port, () => {
  if (appliedLocalRunnerPreset) {
    console.log(
      `Local API runner preset ${appliedLocalRunnerPreset.presetName} applied ` +
        `(DB_MAX_CONNECTIONS=${process.env.DB_MAX_CONNECTIONS}, ` +
        `TICKET_RESERVER_DB_MAX_CONNECTIONS=${process.env.TICKET_RESERVER_DB_MAX_CONNECTIONS}, ` +
        `PAYMENT_BACKGROUND_TASK_CONCURRENCY=${process.env.PAYMENT_BACKGROUND_TASK_CONCURRENCY})`,
    );
  }

  console.log(`Local API runner listening on http://localhost:${port}`);
});
