const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails';

type EmailEnv = {
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
};

type OrderConfirmationItem = {
  name: string;
  quantity: number;
  price?: number | string;
};

type ETicketItem = {
  code: string;
  event_name?: string;
  tier_name?: string;
};

type EmailTemplate = {
  subject: string;
  html: string;
};

type EmailServiceOptions = {
  apiKey?: string;
  from?: string;
  fetchFn?: typeof fetch;
};

export class EmailServiceError extends Error {
  constructor(
    public readonly code: 'EMAIL_API_KEY_MISSING' | 'EMAIL_FROM_MISSING' | 'EMAIL_SEND_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'EmailServiceError';
  }
}

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildEmailShell(title: string, greeting: string, body: string) {
  return `
    <div style="font-family: Arial, sans-serif; background: #f8fafc; padding: 32px; color: #0f172a;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="padding: 28px 32px; background: linear-gradient(135deg, #f97316, #fb923c); color: #ffffff;">
          <p style="margin: 0; font-size: 12px; letter-spacing: 0.32em; text-transform: uppercase; opacity: 0.85;">Jeevatix</p>
          <h1 style="margin: 12px 0 0; font-size: 28px; line-height: 1.2;">${escapeHtml(title)}</h1>
        </div>
        <div style="padding: 32px;">
          <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7;">${greeting}</p>
          ${body}
        </div>
      </div>
    </div>
  `;
}

function formatPrice(price: number | string | undefined) {
  if (price === undefined) {
    return '';
  }

  if (typeof price === 'number') {
    return `Rp ${price.toLocaleString('id-ID')}`;
  }

  return String(price);
}

export class EmailService {
  private readonly apiKey?: string;
  private readonly from?: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: EmailServiceOptions = {}) {
    this.apiKey = options.apiKey ?? getProcessEnv('EMAIL_API_KEY');
    this.from = options.from ?? getProcessEnv('EMAIL_FROM');
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
    if (!this.apiKey) {
      throw new EmailServiceError('EMAIL_API_KEY_MISSING', 'Email API key is not configured.');
    }

    if (!this.from) {
      throw new EmailServiceError('EMAIL_FROM_MISSING', 'Email sender is not configured.');
    }

    const response = await this.fetchFn(RESEND_EMAILS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [to],
        subject,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      let detail = response.statusText;

      try {
        const payload = (await response.json()) as { message?: string; error?: string };
        detail = payload.message ?? payload.error ?? detail;
      } catch {
        detail = response.statusText;
      }

      throw new EmailServiceError(
        'EMAIL_SEND_FAILED',
        `Failed to send email via Resend: ${detail}`,
      );
    }
  }
}

export function createEmailService(env?: EmailEnv) {
  return new EmailService({
    apiKey: env?.EMAIL_API_KEY,
    from: env?.EMAIL_FROM,
  });
}

export function buildVerificationEmail(userName: string, verifyUrl: string): EmailTemplate {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(verifyUrl);

  return {
    subject: 'Verifikasi email akun Jeevatix Anda',
    html: buildEmailShell(
      'Verifikasi Email',
      `Halo ${safeName},`,
      `
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7;">Terima kasih sudah mendaftar di Jeevatix. Klik tombol di bawah ini untuk memverifikasi alamat email Anda.</p>
        <p style="margin: 24px 0;">
          <a href="${safeUrl}" style="display: inline-block; padding: 14px 22px; border-radius: 12px; background: #f97316; color: #ffffff; text-decoration: none; font-weight: 600;">Verifikasi Email</a>
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #475569;">Jika tombol tidak bekerja, salin tautan ini ke browser Anda:<br /><a href="${safeUrl}" style="color: #ea580c;">${safeUrl}</a></p>
      `,
    ),
  };
}

export function buildResetPasswordEmail(userName: string, resetUrl: string): EmailTemplate {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(resetUrl);

  return {
    subject: 'Reset password akun Jeevatix',
    html: buildEmailShell(
      'Reset Password',
      `Halo ${safeName},`,
      `
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7;">Kami menerima permintaan untuk mereset password akun Anda. Klik tombol di bawah ini untuk melanjutkan.</p>
        <p style="margin: 24px 0;">
          <a href="${safeUrl}" style="display: inline-block; padding: 14px 22px; border-radius: 12px; background: #0f172a; color: #ffffff; text-decoration: none; font-weight: 600;">Reset Password</a>
        </p>
        <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #475569;">Jika Anda tidak meminta reset password, abaikan email ini. Tautan ini sebaiknya hanya digunakan sekali.</p>
      `,
    ),
  };
}

export function buildOrderConfirmationEmail(
  userName: string,
  orderNumber: string,
  items: OrderConfirmationItem[],
): EmailTemplate {
  const safeName = escapeHtml(userName);
  const safeOrderNumber = escapeHtml(orderNumber);
  const itemMarkup = items
    .map((item) => {
      const priceLabel = formatPrice(item.price);
      return `
        <li style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
          <strong>${escapeHtml(item.name)}</strong><br />
          <span style="color: #475569;">Qty: ${item.quantity}${priceLabel ? ` • ${escapeHtml(priceLabel)}` : ''}</span>
        </li>
      `;
    })
    .join('');

  return {
    subject: `Konfirmasi pesanan ${orderNumber}`,
    html: buildEmailShell(
      'Pesanan Terkonfirmasi',
      `Halo ${safeName},`,
      `
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7;">Pesanan Anda dengan nomor <strong>${safeOrderNumber}</strong> telah berhasil kami terima.</p>
        <ul style="margin: 0; padding: 0; list-style: none;">${itemMarkup}</ul>
      `,
    ),
  };
}

export function buildETicketEmail(userName: string, tickets: ETicketItem[]): EmailTemplate {
  const safeName = escapeHtml(userName);
  const ticketMarkup = tickets
    .map(
      (ticket) => `
      <li style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
        <strong>${escapeHtml(ticket.event_name ?? 'Event Jeevatix')}</strong><br />
        <span style="color: #475569;">${escapeHtml(ticket.tier_name ?? 'Tiket')} • Kode: ${escapeHtml(ticket.code)}</span>
      </li>
    `,
    )
    .join('');

  return {
    subject: 'E-ticket Jeevatix Anda telah terbit',
    html: buildEmailShell(
      'E-ticket Siap Digunakan',
      `Halo ${safeName},`,
      `
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7;">Berikut detail e-ticket Anda. Simpan email ini dan tunjukkan kode tiket saat check-in.</p>
        <ul style="margin: 0; padding: 0; list-style: none;">${ticketMarkup}</ul>
      `,
    ),
  };
}

export type { ETicketItem, EmailEnv, EmailTemplate, OrderConfirmationItem };
