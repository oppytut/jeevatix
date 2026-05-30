import * as Sentry from '@sentry/cloudflare';

export type BreadcrumbData = Record<
  string,
  string | number | boolean | null | undefined
>;

const PII_KEY_PATTERN =
  /^(email|phone|password|full_name|name|ip|address|user_id|userId|customer_email|customer_id|seller_id|sellerId|raw_token|token|cookie|authorization)$/i;

function sanitize(
  data: BreadcrumbData,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (PII_KEY_PATTERN.test(key)) continue;
    out[key] = value;
  }

  return out;
}

export type BusinessEventName =
  | 'order.created'
  | 'payment.initiated'
  | 'payment.received'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'ticket.reserved'
  | 'ticket.checked_in'
  | 'reservation.created'
  | 'reservation.expired'
  | 'reservation.cancelled'
  | 'reservation.cleanup_processed'
  | 'event.published'
  | 'user.registered'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.refresh';

export function recordBusinessEvent(
  name: BusinessEventName,
  data: BreadcrumbData = {},
) {
  try {
    Sentry.addBreadcrumb({
      category: 'business',
      type: 'info',
      level: 'info',
      message: name,
      data: sanitize(data),
      timestamp: Date.now() / 1000,
    });
  } catch {
    /* sentry not initialized — defense in depth */
  }
}

export async function hashShortId(input: string): Promise<string> {
  try {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    const bytes = new Uint8Array(digest);
    let hex = '';
    for (let i = 0; i < 4; i += 1) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
  } catch {
    return 'unknown';
  }
}
