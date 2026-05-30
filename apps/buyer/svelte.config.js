import adapter from '@sveltejs/adapter-cloudflare';
import { relative, sep } from 'node:path';

const partykitHost = process.env.PUBLIC_PARTYKIT_HOST?.trim();
const apiBaseUrl = process.env.PUBLIC_API_BASE_URL?.trim();

function resolveCspReportUri() {
  if (!apiBaseUrl) {
    return '/csp-report';
  }
  try {
    return new URL('/csp-report', apiBaseUrl).toString();
  } catch {
    return '/csp-report';
  }
}

const cspDirectives = {
  'default-src': ['self'],
  'script-src': ['self', 'wasm-unsafe-eval'],
  'style-src': ['self', 'unsafe-inline'],
  'img-src': ['self', 'https:', 'data:', 'blob:'],
  'font-src': ['self', 'data:'],
  'connect-src': [
    'self',
    'https://*.sentry.io',
    'https://*.ingest.sentry.io',
    ...(partykitHost ? [`wss://${partykitHost}`, `https://${partykitHost}`] : ['wss:', 'ws:']),
  ],
  'frame-ancestors': ['none'],
  'base-uri': ['self'],
  'form-action': ['self'],
  'object-src': ['none'],
  'worker-src': ['self', 'blob:'],
  'manifest-src': ['self'],
  'report-uri': [resolveCspReportUri()],
};

/** @type {import('@sveltejs/kit').Config} */
const config = {
  compilerOptions: {
    // defaults to rune mode for the project, execept for `node_modules`. Can be removed in svelte 6.
    runes: ({ filename }) => {
      const relativePath = relative(import.meta.dirname, filename);
      const pathSegments = relativePath.toLowerCase().split(sep);
      const isExternalLibrary = pathSegments.includes('node_modules');

      return isExternalLibrary ? undefined : true;
    },
  },
  kit: {
    adapter: process.env.PLAYWRIGHT_E2E ? undefined : adapter(),
    csp: {
      mode: 'auto',
      reportOnly: cspDirectives,
    },
  },
};

export default config;
