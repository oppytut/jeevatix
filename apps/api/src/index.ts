import { apiReference } from '@scalar/hono-api-reference';
import { OpenAPIHono } from '@hono/zod-openapi';

const app = new OpenAPIHono();

app.get('/health', (c) => c.json({ status: 'ok' }));

app.doc('/doc', {
  openapi: '3.1.0',
  info: {
    title: 'Jeevatix API',
    version: '1.0.0',
    description: 'High-performance event ticket platform API',
  },
});

app.get('/reference', apiReference({ spec: { url: '/doc' } }));

export default app;