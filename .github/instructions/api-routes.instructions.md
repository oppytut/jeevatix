---
description: "Use when creating or editing API route handlers in apps/api/src/routes/. Covers OpenAPIHono pattern: createRoute(), app.openapi(), request validation, and 3-layer architecture."
applyTo: "apps/api/src/routes/**"
---
# API Route Handler Pattern

Route files are **thin HTTP handlers** (~30 lines). No business logic here.

## Required Pattern

```typescript
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { myInputSchema, myOutputSchema } from '../schemas/my.schema';
import { myService } from '../services/my.service';

const app = new OpenAPIHono();

const myRoute = createRoute({
  method: 'post',
  path: '/my-resource',
  tags: ['MyDomain'],
  summary: 'Short description',
  request: {
    body: { content: { 'application/json': { schema: myInputSchema } } },
    // params: { schema: myParamSchema },
    // query: { schema: myQuerySchema },
  },
  responses: {
    200: { content: { 'application/json': { schema: myOutputSchema } }, description: 'Success' },
    400: { description: 'Bad request' },
  },
});

app.openapi(myRoute, async (c) => {
  const body = c.req.valid('json');     // BUKAN c.req.json()
  // const params = c.req.valid('param');
  // const query = c.req.valid('query');
  const result = await myService.doSomething(body);
  return c.json({ success: true, data: result });
});

export default app;
```

## Rules

- JANGAN taruh business logic di route — delegasikan ke service.
- JANGAN gunakan `c.req.json()` — gunakan `c.req.valid('json')`.
- SELALU definisikan `createRoute()` dengan `tags`, `summary`, `request`, `responses`.
- SELALU register route via `app.openapi(route, handler)`.
- Import schema dari `../schemas/` dan service dari `../services/`.
- Middleware auth: wrap dengan `authMiddleware` atau `roleMiddleware('admin')`.
