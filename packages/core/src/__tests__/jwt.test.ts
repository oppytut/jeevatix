import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';

import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateAccessToken,
  generateRefreshToken,
  JWT_ALGORITHM,
  REFRESH_TOKEN_TTL_SECONDS,
  verifyToken,
} from '../jwt';

const secret = 'vitest-jwt-secret';
const payload = {
  id: 'user-123',
  email: 'buyer@example.com',
  role: 'buyer' as const,
};

describe('jwt utilities', () => {
  it('generates and verifies an access token', async () => {
    const before = Math.floor(Date.now() / 1000);
    const token = await generateAccessToken(payload, secret);
    const verified = await verifyToken(token, secret);

    expect(verified).toMatchObject({
      ...payload,
      type: 'access',
    });
    expect(verified.exp - verified.iat).toBe(ACCESS_TOKEN_TTL_SECONDS);
    expect(verified.iat).toBeGreaterThanOrEqual(before);
  });

  it('generates and verifies a refresh token', async () => {
    const token = await generateRefreshToken(payload, secret);
    const verified = await verifyToken(token, secret);

    expect(verified).toMatchObject({
      ...payload,
      type: 'refresh',
    });
    expect(verified.exp - verified.iat).toBe(REFRESH_TOKEN_TTL_SECONDS);
  });

  it('throws when the token is expired', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await sign(
      {
        ...payload,
        jti: crypto.randomUUID(),
        type: 'access',
        iat: now - 120,
        exp: now - 60,
      },
      secret,
      JWT_ALGORITHM,
    );

    await expect(verifyToken(expiredToken, secret)).rejects.toThrow();
  });
});