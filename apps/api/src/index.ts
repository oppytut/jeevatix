import { apiReference } from '@scalar/hono-api-reference';
import { OpenAPIHono } from '@hono/zod-openapi';

import { TicketReserver } from './durable-objects/ticket-reserver';
import authRoutes from './routes/auth';
import type { AuthEnv } from './middleware/auth';
import { corsMiddleware } from './middleware/cors';
import adminCategoryRoutes from './routes/admin/categories';
import adminUserRoutes from './routes/admin/users';
import publicEventRoutes from './routes/events';
import notificationRoutes from './routes/notifications';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import reservationRoutes from './routes/reservations';
import sellerEventRoutes from './routes/seller/events';
import sellerProfileRoutes from './routes/seller/profile';
import sellerTierRoutes from './routes/seller/tiers';
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
app.route('/notifications', notificationRoutes);
app.route('/orders', orderRoutes);
app.route('/', paymentRoutes);
app.route('/', publicEventRoutes);
app.route('/reservations', reservationRoutes);
app.route('/seller', sellerEventRoutes);
app.route('/seller', sellerProfileRoutes);
app.route('/seller', sellerTierRoutes);
app.route('/upload', uploadRoutes);
app.route('/users', usersRoutes);

export default app;
export { TicketReserver };
