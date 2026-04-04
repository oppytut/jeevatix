import { describe, expect, it } from 'vitest';

import { ACCESS_TOKEN_TTL_SECONDS, generateAccessToken, verifyToken } from '../lib/jwt';
import { hashPassword, verifyPassword } from '../lib/password';

describe('api lib re-exports', () => {
  it('re-exports jwt helpers from core', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await generateAccessToken(
      {
        id: 'user-1',
        email: 'buyer@example.com',
        role: 'buyer',
      },
      'api-lib-secret',
    );

    const payload = await verifyToken(token, 'api-lib-secret');

    expect(payload).toMatchObject({
      id: 'user-1',
      email: 'buyer@example.com',
      role: 'buyer',
      type: 'access',
    });
    expect(payload.iat).toBeGreaterThanOrEqual(before);
    expect(payload.exp - payload.iat).toBe(ACCESS_TOKEN_TTL_SECONDS);
  });

  it('re-exports password helpers from both api lib entrypoints', async () => {
    const hash = await hashPassword('TestPass123!');

    await expect(verifyPassword('TestPass123!', hash)).resolves.toBe(true);
    await expect(verifyPassword('WrongPass123!', hash)).resolves.toBe(false);
  });
});
