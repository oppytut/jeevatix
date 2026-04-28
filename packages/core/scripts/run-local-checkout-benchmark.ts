import { spawn, spawnSync } from 'node:child_process';
import { closeSync, openSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
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
  prewarmReservationConnection?: boolean;
  runnerLogFile?: string;
  runnerProfileSampleEvery?: number;
  checkoutFlowSuccess?: number;
  fullFlowP95?: string;
  checkoutBusinessFlowP95?: string;
  httpReqDurationP95?: string;
  setupLoginHttpDurationP95?: string;
  checkoutHttpDurationP95?: string;
  checkoutBusinessHttpDurationP95?: string;
  prewarmHttpDurationP95?: string;
  stepReservationP95?: string;
  reservationHttpBlockedP95?: string;
  reservationHttpConnectingP95?: string;
  stepOrderP95?: string;
  stepPaymentP95?: string;
  paymentHttpDurationP95?: string;
  stepWebhookP95?: string;
  webhookHttpDurationP95?: string;
  confirmedOrders?: number;
  confirmedTickets?: number;
  issuedTickets?: number;
};

const CANONICAL_TOTAL_USERS = '500';
const CANONICAL_CHECKOUT_LOAD_TEST_USER_COUNT = '500';
const CANONICAL_LOGIN_BATCH_SIZE = '100';

const INHERITED_BENCHMARK_ENV_KEYS = [
  'BASE_URL',
  'TOTAL_USERS',
  'CHECKOUT_LOAD_TEST_USER_COUNT',
  'CHECKOUT_LOAD_TEST_PREFIX',
  'CHECKOUT_LOAD_TEST_FRESH_USERS',
  'LOGIN_BATCH_SIZE',
  'LOAD_TEST_PROFILE',
  'LOAD_TEST_PROFILE_RUNNER',
  'LOAD_TEST_PROFILE_RUNNER_SAMPLE_EVERY',
  'LOAD_TEST_PROFILE_PAYMENT_BACKGROUND',
  'LOAD_TEST_PROFILE_PAYMENT_BACKGROUND_SAMPLE_EVERY',
  'RESERVATION_CONNECTION_CLOSE',
  'PREWARM_RESERVATION_CONNECTION',
  'PRE_RESERVATION_VU_JITTER_MS',
] as const;

const LOCAL_RUNTIME_ENV_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'PAYMENT_WEBHOOK_SECRET',
  'EMAIL_API_KEY',
  'EMAIL_FROM',
  'PARTYKIT_HOST',
  'PARTY_SECRET',
  'APP_ENVIRONMENT',
] as const;

type RunnerProfileOptions = {
  enabled: boolean;
  logFilePath?: string;
  sampleEvery?: number;
};

type ReservationTransportOptions = {
  prewarmReservationConnection: boolean;
};

type ServiceProfileOptions = {
  enabled: boolean;
};

const currentDir = dirname(fileURLToPath(import.meta.url));

function getRepoRoot() {
  return resolve(currentDir, '../../..');
}

function getLocalTsxPath(repoRoot: string) {
  return resolve(repoRoot, 'node_modules/.bin/tsx');
}

function loadDotEnv(envFilePath: string) {
  const fileContents = readFileSync(envFilePath, 'utf8');
  const parsedEnv = {} as Record<string, string>;

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

    if (!key) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const normalizedValue = rawValue.replace(/^['"]|['"]$/gu, '');

    parsedEnv[key] = normalizedValue;

    if (process.env[key] === undefined) {
      process.env[key] = normalizedValue;
    }
  }

  return parsedEnv;
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

function parseStringFlag(argv: string[], flagName: string) {
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === flagName) {
      return argv[index + 1];
    }

    if (value?.startsWith(`${flagName}=`)) {
      return value.slice(flagName.length + 1);
    }
  }

  return undefined;
}

function hasBooleanFlag(argv: string[], flagName: string) {
  return argv.includes(flagName);
}

function parsePositiveInteger(rawValue: string | undefined, flagName: string) {
  if (rawValue === undefined) {
    return undefined;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    throw new Error(`${flagName} must be a positive integer when provided.`);
  }

  return parsedValue;
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

function getRunnerProfileOptions() {
  const argv = process.argv.slice(2);
  const sampleEvery = parsePositiveInteger(
    parseStringFlag(argv, '--profile-runner-sample-every') ??
      process.env.LOCAL_CHECKOUT_PROFILE_RUNNER_SAMPLE_EVERY,
    '--profile-runner-sample-every',
  );
  const enabled =
    hasBooleanFlag(argv, '--profile-runner') ||
    process.env.LOCAL_CHECKOUT_PROFILE_RUNNER === '1' ||
    typeof sampleEvery === 'number';

  if (!enabled) {
    return {
      enabled: false,
    } satisfies RunnerProfileOptions;
  }

  const logFilePath =
    parseStringFlag(argv, '--runner-log-file') ??
    process.env.LOCAL_CHECKOUT_RUNNER_LOG_FILE ??
    resolve(tmpdir(), `jeevatix-local-checkout-profile-${Date.now()}.log`);

  return {
    enabled: true,
    logFilePath,
    sampleEvery,
  } satisfies RunnerProfileOptions;
}

function getReservationTransportOptions() {
  const argv = process.argv.slice(2);

  return {
    prewarmReservationConnection:
      hasBooleanFlag(argv, '--prewarm-reservation-connection') ||
      process.env.LOCAL_CHECKOUT_PREWARM_RESERVATION_CONNECTION === '1',
  } satisfies ReservationTransportOptions;
}

function getServiceProfileOptions() {
  const argv = process.argv.slice(2);

  return {
    enabled:
      hasBooleanFlag(argv, '--profile-services') ||
      process.env.LOCAL_CHECKOUT_PROFILE_SERVICES === '1',
  } satisfies ServiceProfileOptions;
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
  reservationTransportOptions: ReservationTransportOptions,
  runnerProfileOptions?: RunnerProfileOptions,
): BenchmarkSummary {
  return {
    preset,
    baseUrl,
    targetEventSlug: target.targetEventSlug,
    targetTier: target.targetTier,
    exitCode: benchmarkRun.exitCode,
    prewarmReservationConnection: reservationTransportOptions.prewarmReservationConnection,
    runnerLogFile: runnerProfileOptions?.logFilePath,
    runnerProfileSampleEvery: runnerProfileOptions?.sampleEvery,
    checkoutFlowSuccess: parseCountMetric(benchmarkRun.output, 'checkout_flow_success'),
    fullFlowP95: parseP95Metric(benchmarkRun.output, 'full_flow_duration'),
    checkoutBusinessFlowP95: parseP95Metric(benchmarkRun.output, 'checkout_business_flow_duration'),
    httpReqDurationP95: parseP95Metric(benchmarkRun.output, 'http_req_duration'),
    setupLoginHttpDurationP95: parseP95Metric(benchmarkRun.output, 'setup_login_http_duration'),
    checkoutHttpDurationP95: parseP95Metric(benchmarkRun.output, 'checkout_http_duration'),
    checkoutBusinessHttpDurationP95: parseP95Metric(
      benchmarkRun.output,
      'checkout_business_http_duration',
    ),
    prewarmHttpDurationP95: parseP95Metric(benchmarkRun.output, 'prewarm_http_duration'),
    stepReservationP95: parseP95Metric(benchmarkRun.output, 'step_reservation_duration'),
    reservationHttpBlockedP95: parseP95Metric(benchmarkRun.output, 'reservation_http_blocked'),
    reservationHttpConnectingP95: parseP95Metric(
      benchmarkRun.output,
      'reservation_http_connecting',
    ),
    stepOrderP95: parseP95Metric(benchmarkRun.output, 'step_order_duration'),
    stepPaymentP95: parseP95Metric(benchmarkRun.output, 'step_payment_duration'),
    paymentHttpDurationP95: parseP95Metric(benchmarkRun.output, 'payment_http_duration'),
    stepWebhookP95: parseP95Metric(benchmarkRun.output, 'step_webhook_duration'),
    webhookHttpDurationP95: parseP95Metric(benchmarkRun.output, 'webhook_http_duration'),
    confirmedOrders: parseValidationCount(benchmarkRun.output, 'confirmed_orders'),
    confirmedTickets: parseValidationCount(benchmarkRun.output, 'confirmed_tickets'),
    issuedTickets: parseValidationCount(benchmarkRun.output, 'issued_tickets'),
  };
}

function getInheritedBenchmarkEnvWarnings(baseUrl: string) {
  const warnings = [] as string[];

  if (process.env.BASE_URL && process.env.BASE_URL !== baseUrl) {
    warnings.push(`BASE_URL=${process.env.BASE_URL}`);
  }

  for (const key of INHERITED_BENCHMARK_ENV_KEYS) {
    if (key === 'BASE_URL') {
      continue;
    }

    const value = process.env[key];

    if (value !== undefined) {
      warnings.push(`${key}=${value}`);
    }
  }

  return warnings;
}

function getOverriddenLocalRuntimeEnvWarnings(localDotEnv: Record<string, string>) {
  const warnings = [] as string[];

  for (const key of LOCAL_RUNTIME_ENV_KEYS) {
    const inheritedValue = process.env[key];
    const localValue = localDotEnv[key];

    if (inheritedValue !== undefined && localValue !== undefined && inheritedValue !== localValue) {
      warnings.push(key);
    }
  }

  return warnings;
}

function buildLocalBenchmarkBaseEnv(localDotEnv: Record<string, string>) {
  return {
    ...process.env,
    ...localDotEnv,
  } satisfies NodeJS.ProcessEnv;
}

function buildCanonicalBenchmarkEnv(
  baseEnv: NodeJS.ProcessEnv,
  baseUrl: string,
  port?: number,
  reservationTransportOptions?: ReservationTransportOptions,
  serviceProfileOptions?: ServiceProfileOptions,
  runnerProfileOptions?: RunnerProfileOptions,
) {
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    BASE_URL: baseUrl,
    CHECKOUT_LOAD_TEST_FRESH_USERS: '1',
    CHECKOUT_LOAD_TEST_USER_COUNT: CANONICAL_CHECKOUT_LOAD_TEST_USER_COUNT,
    TOTAL_USERS: CANONICAL_TOTAL_USERS,
    LOGIN_BATCH_SIZE: CANONICAL_LOGIN_BATCH_SIZE,
  };

  if (typeof port === 'number') {
    env.PORT = String(port);
  }

  delete env.CHECKOUT_LOAD_TEST_PREFIX;
  delete env.LOAD_TEST_PROFILE;
  delete env.LOAD_TEST_PROFILE_RUNNER;
  delete env.LOAD_TEST_PROFILE_RUNNER_SAMPLE_EVERY;
  delete env.LOAD_TEST_PROFILE_PAYMENT_BACKGROUND;
  delete env.LOAD_TEST_PROFILE_PAYMENT_BACKGROUND_SAMPLE_EVERY;
  delete env.RESERVATION_CONNECTION_CLOSE;
  delete env.PREWARM_RESERVATION_CONNECTION;
  delete env.PRE_RESERVATION_VU_JITTER_MS;

  if (reservationTransportOptions?.prewarmReservationConnection) {
    env.PREWARM_RESERVATION_CONNECTION = '1';
  }

  if (serviceProfileOptions?.enabled) {
    env.LOAD_TEST_PROFILE = '1';
  }

  if (runnerProfileOptions?.enabled) {
    env.LOAD_TEST_PROFILE_RUNNER = '1';
    env.LOAD_TEST_PROFILE_PAYMENT_BACKGROUND = '1';

    if (typeof runnerProfileOptions.sampleEvery === 'number') {
      env.LOAD_TEST_PROFILE_RUNNER_SAMPLE_EVERY = String(runnerProfileOptions.sampleEvery);
      env.LOAD_TEST_PROFILE_PAYMENT_BACKGROUND_SAMPLE_EVERY = String(
        runnerProfileOptions.sampleEvery,
      );
    }
  }

  return env;
}

function createBenchmarkTarget(repoRoot: string, baseEnv: NodeJS.ProcessEnv) {
  const result = spawnSync(
    'pnpm',
    ['--filter', '@jeevatix/core', 'exec', 'tsx', 'scripts/create-checkout-benchmark-target.ts'],
    {
      cwd: repoRoot,
      env: baseEnv,
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
  baseEnv: NodeJS.ProcessEnv,
  baseUrl: string,
  target: BenchmarkTarget,
  reservationTransportOptions?: ReservationTransportOptions,
  serviceProfileOptions?: ServiceProfileOptions,
): BenchmarkRunResult {
  const benchmarkEnv = buildCanonicalBenchmarkEnv(
    baseEnv,
    baseUrl,
    undefined,
    reservationTransportOptions,
    serviceProfileOptions,
  );

  const result = spawnSync(
    'pnpm',
    ['--filter', '@jeevatix/core', 'exec', 'tsx', 'scripts/run-load-scenario.ts', 'checkout-flow'],
    {
      cwd: repoRoot,
      env: {
        ...benchmarkEnv,
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

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));

  try {
    process.kill(-runnerPid, 0);
    process.kill(-runnerPid, 'SIGKILL');
  } catch {
    // Already stopped.
  }
}

async function main() {
  const repoRoot = getRepoRoot();
  const localDotEnv = loadDotEnv(resolve(repoRoot, '.env'));
  const localBaseEnv = buildLocalBenchmarkBaseEnv(localDotEnv);

  const preset = getRunnerPreset();
  const runnerProfileOptions = getRunnerProfileOptions();
  const reservationTransportOptions = getReservationTransportOptions();
  const serviceProfileOptions = getServiceProfileOptions();
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const runnerPath = resolve(repoRoot, 'scripts/run-api-local.ts');
  const tsxPath = getLocalTsxPath(repoRoot);
  const inheritedWarnings = getInheritedBenchmarkEnvWarnings(baseUrl);
  const overriddenRuntimeWarnings = getOverriddenLocalRuntimeEnvWarnings(localDotEnv);

  if (inheritedWarnings.length > 0) {
    console.warn(
      `[local-checkout] ignoring inherited benchmark env and using canonical local settings: ${inheritedWarnings.join(', ')}`,
    );
  }

  if (overriddenRuntimeWarnings.length > 0) {
    console.warn(
      `[local-checkout] overriding inherited runtime env from local .env for keys: ${overriddenRuntimeWarnings.join(', ')}`,
    );
  }

  console.log(`[local-checkout] preset=${preset}`);
  console.log(`[local-checkout] baseUrl=${baseUrl}`);

  if (reservationTransportOptions.prewarmReservationConnection) {
    console.log('[local-checkout] prewarmReservationConnection=1');
  }

  if (serviceProfileOptions.enabled) {
    console.log('[local-checkout] profileServices=1');
  }

  if (runnerProfileOptions.logFilePath) {
    console.log(`[local-checkout] runnerLogFile=${runnerProfileOptions.logFilePath}`);
  }

  const runnerEnv = buildCanonicalBenchmarkEnv(
    localBaseEnv,
    baseUrl,
    port,
    reservationTransportOptions,
    serviceProfileOptions,
    runnerProfileOptions,
  );
  const runnerLogFileDescriptor = runnerProfileOptions.logFilePath
    ? openSync(runnerProfileOptions.logFilePath, 'a')
    : undefined;

  const runnerProcess = spawn(tsxPath, [runnerPath, '--preset', preset], {
    cwd: repoRoot,
    env: runnerEnv,
    detached: true,
    stdio:
      typeof runnerLogFileDescriptor === 'number'
        ? ['ignore', runnerLogFileDescriptor, runnerLogFileDescriptor]
        : 'inherit',
  });

  const cleanup = async () => stopRunner(runnerProcess.pid);
  const handleSignal = async () => {
    await cleanup();
    process.exit(1);
  };

  process.once('SIGINT', handleSignal);
  process.once('SIGTERM', handleSignal);

  try {
    await waitForRunnerHealth(baseUrl, 30_000, runnerProcess.pid ?? 0);

    const target = createBenchmarkTarget(repoRoot, localBaseEnv);
    console.log(
      `[local-checkout] targetEventSlug=${target.targetEventSlug} targetTier=${target.targetTier}`,
    );

    const benchmarkRun = runCheckoutScenario(
      repoRoot,
      localBaseEnv,
      baseUrl,
      target,
      reservationTransportOptions,
      serviceProfileOptions,
    );
    const summary = buildBenchmarkSummary(
      preset,
      baseUrl,
      target,
      benchmarkRun,
      reservationTransportOptions,
      runnerProfileOptions,
    );

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

    if (typeof runnerLogFileDescriptor === 'number') {
      closeSync(runnerLogFileDescriptor);
    }
  }
}

await main();
