import { describe, expect, it, vi, beforeEach } from 'vitest';

const addBreadcrumbMock = vi.fn();

vi.mock('@sentry/cloudflare', () => ({
  addBreadcrumb: (...args: unknown[]) => addBreadcrumbMock(...args),
}));

import { hashShortId, recordBusinessEvent } from '../lib/sentry-breadcrumbs';

beforeEach(() => {
  addBreadcrumbMock.mockReset();
});

describe('recordBusinessEvent', () => {
  it('emits a sentry breadcrumb with category business and sanitized data', () => {
    recordBusinessEvent('order.created', {
      order_id: 'ord_1',
      total_idr: 250_000,
    });

    expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
    const arg = addBreadcrumbMock.mock.calls[0]?.[0];
    expect(arg.category).toBe('business');
    expect(arg.message).toBe('order.created');
    expect(arg.data).toEqual({ order_id: 'ord_1', total_idr: 250_000 });
  });

  it('drops PII-shaped keys (email, phone, full_name, customer_email, raw seller_id, user_id)', () => {
    recordBusinessEvent('user.registered', {
      role: 'buyer',
      email: 'leak@example.com',
      phone: '+62 800',
      full_name: 'Jane',
      user_id: 'uid_real',
      customer_email: 'leak2@example.com',
      seller_id: 'sel_real',
    });

    const data = addBreadcrumbMock.mock.calls[0]?.[0]?.data ?? {};
    expect(data).toEqual({ role: 'buyer' });
  });

  it('does not throw when sentry add breadcrumb itself throws', () => {
    addBreadcrumbMock.mockImplementation(() => {
      throw new Error('sentry not initialized');
    });

    expect(() =>
      recordBusinessEvent('ticket.reserved', { event_id: 'evt_1', qty: 2 }),
    ).not.toThrow();
  });
});

describe('hashShortId', () => {
  it('returns a stable 8-char hex prefix for the same input', async () => {
    const a = await hashShortId('user-id-123');
    const b = await hashShortId('user-id-123');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it('returns different prefixes for different inputs', async () => {
    const a = await hashShortId('alpha');
    const b = await hashShortId('beta');
    expect(a).not.toBe(b);
  });
});
