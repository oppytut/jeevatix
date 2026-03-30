import { cors } from 'hono/cors';

export const allowedOrigins = [
  'http://localhost:4301',
  'http://localhost:4302',
  'http://localhost:4303',
];

export const corsMiddleware = cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});
