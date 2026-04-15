import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type RunnerPresetName = 'load-baseline' | 'load-balanced' | 'load-fullflow';

type BenchmarkTarget = {
  targetEventSlug: string;
  targetTier: string;
};

type BenchmarkRunResult = {
  exitCode: number;
  output: string;
};

type BenchmarkSummary = {
  preset: RunnerPresetName;
  baseUrl: string;
  targetEventSlug: string;
  targetTier: string;
  exitCode: number;
  checkoutFlowSuccess?: number;
  fullFlowP95?: string;
  httpReqDurationP95?: string;
  stepReservationP95?: string;
  stepOrderP95?: string;
  stepPaymentP95?: string;
  stepWebhookP95?: string;
  confirmedOrders?: number;
  confirmedTickets?: number;
  issuedTickets?: number;
};

const currentDir = dirname(fileURLToPath(import.meta.url));

function getRepoRoot() {
  return resolve(currentDir, '../../..');
}

function loadDotEnv(envFilePath: string) {
  const fileContents = readFileSync(envFilePath, 'utf8');

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

function parsePresetArg(argv: string[]) {
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

function isRunnerPresetName(value: string | undefined): value is RunnerPresetName {
  return value === 'load-baseline' || value === 'load-balanced' || value === 'load-fullflow';
}

function getRunnerPreset() {
  const rawValue = parsePresetArg(process.argv.slice(2)) ?? process.env.LOAD_TEST_RUNNER_PRESET;

  if (!rawValue) {
    return 'load-balanced' as const;
  }

  if (!isRunnerPresetName(rawValue)) {
    throw new Error(
      `Unknown runner preset \"${rawValue}\". Expected one of: load-baseline, load-balanced, load-fullflow.`,
    );
  }

  return rawValue;
}

async function findAvailablePort() {
  if (process.env.PORT) {
    return Number.parseInt(process.env.PORT, 10);
  }

  return await new Promise<number>((resolvePort, reject) => {
    const probe = createServer();

    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();

      if (!address || typeof address === 'string') {
        reject(
          new Error('Failed to determine a free local port for the checkout benchmark runner.'),
        );
        return;
      }

      const { port } = address;
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolvePort(port);
      });
    });
  });
}

async function waitForRunnerHealth(baseUrl: string, timeoutMs: number, runnerPid: number) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // The runner may still be starting.
    }

    try {
      process.kill(runnerPid, 0);
    } catch {
      throw new Error('The local checkout benchmark runner exited before it became healthy.');
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }

  throw new Error(
    `Timed out waiting for local checkout benchmark runner health at ${baseUrl}/health.`,
  );
}

function parseJsonLine<T>(rawOutput: string) {
  const lines = rawOutput
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  const jsonLine = lines.find((line) => line.startsWith('{') && line.endsWith('}'));

  if (!jsonLine) {
    throw new Error(`Expected a JSON line in command output, received:\n${rawOutput}`);
  }

  return JSON.parse(jsonLine) as T;
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function parseCountMetric(output: string, metricName: string) {
  const pattern = new RegExp(`^\\s*${escapeForRegExp(metricName)}\\.+:\\s*([0-9]+)\\b`, 'mu');
  const match = output.match(pattern);

  if (!match) {
    return undefined;
  }

  const parsedValue = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function parseP95Metric(output: string, metricName: string) {
  const pattern = new RegExp(`^\\s*${escapeForRegExp(metricName)}\\.+:.*p\\(95\\)=([^\\s]+)`, 'mu');
  const match = output.match(pattern);

  return match?.[1];
}

function parseValidationCount(
  output: string,
  key: 'confirmed_orders' | 'confirmed_tickets' | 'issued_tickets',
) {
  const pattern = new RegExp(`^\\[validate\\] ${escapeForRegExp(key)}=([0-9]+)\\s*$`, 'mu');
  const match = output.match(pattern);

  if (!match) {
    return undefined;
  }

  const parsedValue = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function buildBenchmarkSummary(
  preset: RunnerPresetName,
  baseUrl: string,
  target: BenchmarkTarget,
  benchmarkRun: BenchmarkRunResult,
): BenchmarkSummary {
  return {
    preset,
    baseUrl,
    targetEventSlug: target.targetEventSlug,
    targetTier: target.targetTier,
    exitCode: benchmarkRun.exitCode,
    checkoutFlowSuccess: parseCountMetric(benchmarkRun.output, 'checkout_flow_success'),
    fullFlowP95: parseP95Metric(benchmarkRun.output, 'full_flow_duration'),
    httpReqDurationP95: parseP95Metric(benchmarkRun.output, 'http_req_duration'),
    stepReservationP95: parseP95Metric(benchmarkRun.output, 'step_reservation_duration'),
    stepOrderP95: parseP95Metric(benchmarkRun.output, 'step_order_duration'),
    stepPaymentP95: parseP95Metric(benchmarkRun.output, 'step_payment_duration'),
    stepWebhookP95: parseP95Metric(benchmarkRun.output, 'step_webhook_duration'),
    confirmedOrders: parseValidationCount(benchmarkRun.output, 'confirmed_orders'),
    confirmedTickets: parseValidationCount(benchmarkRun.output, 'confirmed_tickets'),
    issuedTickets: parseValidationCount(benchmarkRun.output, 'issued_tickets'),
  };
}

function createBenchmarkTarget(repoRoot: string) {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@jeevatix/core', 'exec', 'tsx', 'scripts/create-checkout-benchmark-target.ts'],
    {
      cwd: repoRoot,
      env: process.env,
      encoding: 'utf8',
    },
  );

  if ((result.status ?? 1) !== 0) {
    throw new Error(result.stderr || 'Failed to create a checkout benchmark target.');
  }

  return parseJsonLine<BenchmarkTarget>(result.stdout);
}

function runCheckoutScenario(
  repoRoot: string,
  baseUrl: string,
  target: BenchmarkTarget,
): BenchmarkRunResult {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@jeevatix/core', 'exec', 'tsx', 'scripts/run-load-scenario.ts', 'checkout-flow'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        BASE_URL: baseUrl,
        CHECKOUT_LOAD_TEST_FRESH_USERS: process.env.CHECKOUT_LOAD_TEST_FRESH_USERS ?? '1',
        TARGET_EVENT_SLUG: target.targetEventSlug,
        TARGET_TIER: target.targetTier,
      },
      encoding: 'utf8',
    },
  );

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';

  if (stdout) {
    process.stdout.write(stdout);
  }

  if (stderr) {
    process.stderr.write(stderr);
  }

  return {
    exitCode: result.status ?? 1,
    output: `${stdout}\n${stderr}`,
  };
}

async function stopRunner(runnerPid: number | undefined) {
  if (!runnerPid) {
    return;
  }

  try {
    process.kill(-runnerPid, 'SIGTERM');
  } catch {
    return;
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));

  try {
    process.kill(-runnerPid, 0);
    process.kill(-runnerPid, 'SIGKILL');
  } catch {
    // Already stopped.
  }
}

async function main() {
  const repoRoot = getRepoRoot();
  loadDotEnv(resolve(repoRoot, '.env'));

  const preset = getRunnerPreset();
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const runnerPath = resolve(repoRoot, 'scripts/run-api-local.ts');

  if (process.env.BASE_URL && process.env.BASE_URL !== baseUrl) {
    console.warn(
      `[local-checkout] ignoring inherited BASE_URL=${process.env.BASE_URL}; using spawned local runner ${baseUrl}`,
    );
  }

  console.log(`[local-checkout] preset=${preset}`);
  console.log(`[local-checkout] baseUrl=${baseUrl}`);

  const runnerProcess = spawn(
    'pnpm',
    ['--filter', '@jeevatix/core', 'exec', 'tsx', runnerPath, '--preset', preset],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        BASE_URL: baseUrl,
        PORT: String(port),
      },
      detached: true,
      stdio: 'inherit',
    },
  );

  const cleanup = async () => stopRunner(runnerProcess.pid);
  const handleSignal = async () => {
    await cleanup();
    process.exit(1);
  };

  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  try {
    await waitForRunnerHealth(baseUrl, 30_000, runnerProcess.pid ?? 0);

    const target = createBenchmarkTarget(repoRoot);
    console.log(
      `[local-checkout] targetEventSlug=${target.targetEventSlug} targetTier=${target.targetTier}`,
    );

    const benchmarkRun = runCheckoutScenario(repoRoot, baseUrl, target);
    const summary = buildBenchmarkSummary(preset, baseUrl, target, benchmarkRun);

    console.log('[local-checkout-summary]', JSON.stringify(summary));

    process.exitCode = benchmarkRun.exitCode;
  } finally {
    process.removeListener('SIGINT', handleSignal);
    process.removeListener('SIGTERM', handleSignal);
    await cleanup();

    if (runnerProcess.exitCode === null) {
      try {
        await Promise.race([
          once(runnerProcess, 'exit'),
          new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000)),
        ]);
      } catch {
        // Ignore shutdown races.
      }
    }
  }
}

await main();
