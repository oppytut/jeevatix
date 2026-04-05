import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { app } from '../apps/api/src/index';
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

process.env.JWT_SECRET ||= 'local-load-test-jwt-secret';
process.env.PAYMENT_WEBHOOK_SECRET ||= 'local-load-test-webhook-secret';

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

  fetch(input: RequestInfo | URL, init?: RequestInit) {
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
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
  EMAIL_API_KEY: process.env.EMAIL_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  PARTYKIT_HOST: process.env.PARTYKIT_HOST,
  PARTY_SECRET: process.env.PARTY_SECRET,
};

env.TICKET_RESERVER = new LocalDurableObjectNamespace(env, TicketReserver);

const server = createServer(async (nodeRequest, nodeResponse) => {
  try {
    const origin = `http://${nodeRequest.headers.host ?? `localhost:${port}`}`;
    const url = new URL(nodeRequest.url ?? '/', origin);
    const body =
      nodeRequest.method === 'GET' || nodeRequest.method === 'HEAD'
        ? undefined
        : await readRequestBody(nodeRequest);

    const request = new Request(url, {
      method: nodeRequest.method,
      headers: new Headers(nodeRequest.headers as Record<string, string>),
      body,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    const ctx = new LocalExecutionContext();
    const response = await app.fetch(request, env as never, ctx as never);
    const headers = Object.fromEntries(response.headers.entries());

    nodeResponse.writeHead(response.status, headers);

    if (response.body) {
      const bodyBuffer = Buffer.from(await response.arrayBuffer());
      nodeResponse.end(bodyBuffer);
      return;
    }

    nodeResponse.end();
  } catch (error) {
    console.error('Local API runner failed to handle request.', error);
    nodeResponse.writeHead(500, { 'content-type': 'application/json' });
    nodeResponse.end(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unexpected error occurred.' },
      }),
    );
  }
});

server.listen(port, () => {
  console.log(`Local API runner listening on http://localhost:${port}`);
});
