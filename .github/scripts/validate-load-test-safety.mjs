import { promises as fs } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();

const errors = [];

async function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), 'utf8');
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function walk(relativeDir) {
  const root = path.join(repoRoot, relativeDir);
  const entries = await fs.readdir(root, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const childRelative = path.posix.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      results.push(...(await walk(childRelative)));
      continue;
    }

    results.push(childRelative);
  }

  return results;
}

function requireMatch(relativePath, content, pattern, message) {
  if (!pattern.test(content)) {
    errors.push(`${relativePath}: ${message}`);
  }
}

async function validateGuardrailFiles() {
  const requiredFiles = [
    '.github/instructions/load-testing.instructions.md',
    '.github/hooks/load-test-approval.json',
    '.github/hooks/load-test-approval.mjs',
    '.github/prompts/load-test-preflight.prompt.md',
  ];

  for (const relativePath of requiredFiles) {
    if (!(await exists(relativePath))) {
      errors.push(`${relativePath}: required load-test safety guardrail file is missing.`);
    }
  }

  const copilotInstructions = await read('.github/copilot-instructions.md');
  requireMatch(
    '.github/copilot-instructions.md',
    copilotInstructions,
    /## Load Test Safety/,
    'workspace instructions must include a Load Test Safety section.',
  );
}

async function validateLoadScenarioFiles() {
  const loadTestFiles = (await walk('tests/load')).filter((relativePath) =>
    /\.(?:js|ts|mjs|cjs)$/i.test(relativePath),
  );

  for (const relativePath of loadTestFiles) {
    const content = await read(relativePath);

    requireMatch(
      relativePath,
      content,
      /(?:__ENV\.|process\.env\.)BASE_URL|const\s+BASE_URL\s*=.+localhost/is,
      'load-test files must scope target URLs through BASE_URL or an explicit local default.',
    );

    requireMatch(
      relativePath,
      content,
      /TARGET_TIER|TARGET_EVENT_SLUG|LOAD_TEST_|CHECKOUT_LOAD_TEST_/,
      'load-test files must declare explicit target or load-test env inputs.',
    );
  }
}

async function validateLoadHelperScripts() {
  const helperFiles = (await walk('packages/core/scripts')).filter((relativePath) =>
    /(load|benchmark)/i.test(path.basename(relativePath)),
  );

  for (const relativePath of helperFiles) {
    const content = await read(relativePath);

    requireMatch(
      relativePath,
      content,
      /BASE_URL|SST_STAGE|DATABASE_URL|TARGET_TIER|TARGET_EVENT_SLUG|LOAD_TEST_|CHECKOUT_LOAD_TEST_/,
      'load-test helper scripts must use explicit env scoping or target variables.',
    );

    requireMatch(
      relativePath,
      content,
      /localhost|local runner|seed-load-users|cleanup-load-test-data|synthetic|fresh user|fresh checkout|LOAD_TEST_RUNNER_PRESET/i,
      'load-test helper scripts must show local scoping, synthetic targeting, or cleanup/seed awareness.',
    );
  }
}

async function validateLoadDataScripts() {
  const checks = [
    {
      relativePath: 'packages/core/src/db/seed-load-users.ts',
      patterns: [
        {
          pattern: /LOAD_TEST_|CHECKOUT_LOAD_TEST_/,
          message: 'seed script must be driven by explicit load-test env variables.',
        },
        {
          pattern: /closeDb\s*\(/,
          message: 'seed script must close DB connections explicitly.',
        },
      ],
    },
    {
      relativePath: 'packages/core/src/db/cleanup-load-test-data.ts',
      patterns: [
        {
          pattern: /load-test|loadtest|checkoutfresh|checkout\+/i,
          message: 'cleanup script must target synthetic load-test artifacts explicitly.',
        },
        {
          pattern: /closeDb\s*\(/,
          message: 'cleanup script must close DB connections explicitly.',
        },
      ],
    },
  ];

  for (const { relativePath, patterns } of checks) {
    const content = await read(relativePath);

    for (const { pattern, message } of patterns) {
      requireMatch(relativePath, content, pattern, message);
    }
  }
}

await validateGuardrailFiles();
await validateLoadScenarioFiles();
await validateLoadHelperScripts();
await validateLoadDataScripts();

if (errors.length > 0) {
  console.error('Load-test safety validation failed:');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  process.exit(1);
}

console.log('Load-test safety validation passed.');