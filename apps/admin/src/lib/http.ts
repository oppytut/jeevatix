import { dev } from '$app/environment';
import { PUBLIC_API_BASE_URL } from '$env/static/public';

export const API_BASE_URL =
  PUBLIC_API_BASE_URL || (dev ? 'http://localhost:8787' : 'https://api.jeevatix.com');

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
