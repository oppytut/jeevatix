import { describe, expect, it } from 'vitest';

import { buildTicketCode } from '../services/ticket-generator';

describe('ticket code utilities', () => {
  it('formats ticket codes as JVX plus a 12 character identifier', () => {
    const value = buildTicketCode('ABC123DEF456');

    expect(value).toBe('JVX-ABC123DEF456');
    expect(value).toMatch(/^JVX-[0-9A-Z]{12}$/);
  });

  it('generates unique ticket codes', () => {
    const values = new Set(Array.from({ length: 100 }, () => buildTicketCode()));

    expect(values.size).toBe(100);
  });
});