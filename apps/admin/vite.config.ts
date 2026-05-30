import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { defineConfig } from 'vite';

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;
const sentryOrg = process.env.SENTRY_ORG;
const sentryProject = process.env.SENTRY_PROJECT_ADMIN;

const sentryPlugin =
  sentryAuthToken && sentryOrg && sentryProject
    ? sentrySvelteKit({
        org: sentryOrg,
        project: sentryProject,
        authToken: sentryAuthToken,
        adapter: 'cloudflare',
      })
    : null;

export default defineConfig({
  plugins: [tailwindcss(), ...(sentryPlugin ? [sentryPlugin] : []), sveltekit()],
  server: {
    port: 4302,
  },
});
