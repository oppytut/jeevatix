import { cors } from 'hono/cors';

export const allowedOrigins = [
  'http://localhost:4301',
  'http://localhost:4302',
  'http://localhost:4303',
  'https://jeevatix.com',
  'https://admin.jeevatix.com',
  'https://seller.jeevatix.com',
];

export const corsMiddleware = cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
