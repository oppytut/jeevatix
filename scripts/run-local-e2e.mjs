#!/usr/bin/env node
// Wrapper for `pnpm run test:e2e:local`.
//
// Loads env from .env then .env.e2e.local (later wins for already-empty keys),
// forces E2E_TARGET=local + PLAYWRIGHT_E2E=1, then invokes `playwright test`
// with every CLI arg forwarded as-is. Keeps `pnpm run test:e2e` (default) and
// `E2E_TARGET=staging pnpm run test:e2e` (staging) untouched.

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

function loadDotEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const sep = line.indexOf('=');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    if (!key) continue;
    if (process.env[key] !== undefined && process.env[key] !== '') continue;
    const value = line
      .slice(sep + 1)
      .trim()
      .replace(/^['"]|['"]$/gu, '');
    process.env[key] = value;
  }
}

loadDotEnvFile(resolve(repoRoot, '.env'));
loadDotEnvFile(resolve(repoRoot, '.env.e2e.local'));

process.env.E2E_TARGET = 'local';
process.env.PLAYWRIGHT_E2E = '1';

const forwardedArgs = process.argv.slice(2).filter((arg) => arg !== '--');

const child = spawn('pnpm', ['exec', 'playwright', 'test', ...forwardedArgs], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
