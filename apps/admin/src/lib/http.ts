import { dev } from '$app/environment';

export const API_BASE_URL =
  import.meta.env.PUBLIC_API_BASE_URL ||
  (dev ? 'http://localhost:8787' : 'https://api.jeevatix.com');

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string = 'API_ERROR',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
