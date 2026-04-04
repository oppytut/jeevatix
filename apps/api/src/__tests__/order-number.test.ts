import { describe, expect, it } from 'vitest';

import { formatOrderNumber } from '../services/order.service';

describe('order number utilities', () => {
  it('formats order numbers as JVX-YYYYMMDD-XXXXX', () => {
    const value = formatOrderNumber(new Date('2026-04-02T12:34:56.000Z'), '12345');

    expect(value).toBe('JVX-20260402-12345');
    expect(value).toMatch(/^JVX-\d{8}-\d{5}$/);
  });

  it('produces unique values for different suffixes on the same date', () => {
    const values = new Set(
      Array.from({ length: 25 }, (_, index) =>
        formatOrderNumber(new Date('2026-04-02T12:34:56.000Z'), index.toString().padStart(5, '0')),
      ),
    );

    expect(values.size).toBe(25);
  });
});
