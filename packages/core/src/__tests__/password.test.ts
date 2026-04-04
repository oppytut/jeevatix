import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../password';

describe('password utilities', () => {
  it('hashes a password and verifies the correct value', async () => {
    const password = 'TestPass123!';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('TestPass123!');

    await expect(verifyPassword('WrongPass123!', hash)).resolves.toBe(false);
  });
});
