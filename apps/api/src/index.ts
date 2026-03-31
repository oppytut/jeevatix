import { apiReference } from '@scalar/hono-api-reference';
import { OpenAPIHono } from '@hono/zod-openapi';

import authRoutes from './routes/auth';
import type { AuthEnv } from './middleware/auth';
import { corsMiddleware } from './middleware/cors';
import adminCategoryRoutes from './routes/admin/categories';
import adminUserRoutes from './routes/admin/users';
import sellerEventRoutes from './routes/seller/events';
import sellerProfileRoutes from './routes/seller/profile';
import uploadRoutes from './routes/upload';
import usersRoutes from './routes/users';

const app = new OpenAPIHono<AuthEnv>();

app.use('*', corsMiddleware);

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

app.route('/admin/categories', adminCategoryRoutes);
app.route('/admin', adminUserRoutes);
app.route('/auth', authRoutes);
app.route('/seller', sellerEventRoutes);
app.route('/seller', sellerProfileRoutes);
app.route('/upload', uploadRoutes);
app.route('/users', usersRoutes);

export default app;
