import { describe, expect, it, vi } from 'vitest';

import {
  buildETicketEmail,
  buildOrderConfirmationEmail,
  buildResetPasswordEmail,
  buildVerificationEmail,
  createEmailService,
  EmailService,
  EmailServiceError,
} from '../services/email';

describe('email service', () => {
  it('throws when the API key is missing', async () => {
    const service = new EmailService({ from: 'Jeevatix <noreply@example.com>' });

    await expect(service.sendEmail('buyer@example.com', 'Test', '<p>Hello</p>')).rejects.toMatchObject<EmailServiceError>({
      code: 'EMAIL_API_KEY_MISSING',
    });
  });

  it('throws when the sender address is missing', async () => {
    const service = new EmailService({ apiKey: 'test-key' });

    await expect(service.sendEmail('buyer@example.com', 'Test', '<p>Hello</p>')).rejects.toMatchObject<EmailServiceError>({
      code: 'EMAIL_FROM_MISSING',
    });
  });

  it('sends email payloads through Resend', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }));
    const service = new EmailService({
      apiKey: 'test-key',
      from: 'Jeevatix <noreply@example.com>',
      fetchFn,
    });

    await expect(service.sendEmail('buyer@example.com', 'Hello', '<p>World</p>')).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    );
  });

  it('surfaces API failure details from Resend', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ message: 'quota exceeded' }), {
        status: 429,
        statusText: 'Too Many Requests',
      }),
    );
    const service = new EmailService({
      apiKey: 'test-key',
      from: 'Jeevatix <noreply@example.com>',
      fetchFn,
    });

    await expect(service.sendEmail('buyer@example.com', 'Hello', '<p>World</p>')).rejects.toMatchObject<EmailServiceError>({
      code: 'EMAIL_SEND_FAILED',
      message: 'Failed to send email via Resend: quota exceeded',
    });
  });

  it('builds escaped verification, reset, order, and e-ticket templates', () => {
    const verification = buildVerificationEmail('Ayu <Buyer>', 'https://example.com/verify?token=abc');
    const reset = buildResetPasswordEmail('Ayu <Buyer>', 'https://example.com/reset?token=abc');
    const order = buildOrderConfirmationEmail('Ayu <Buyer>', 'JVX-20260402-12345', [
      { name: 'VIP <Seat>', quantity: 2, price: 250000 },
    ]);
    const eticket = buildETicketEmail('Ayu <Buyer>', [
      { code: 'JVX-ABC123DEF456', event_name: 'Concert <Live>', tier_name: 'VIP <Front>' },
    ]);

    expect(verification.subject).toContain('Verifikasi');
    expect(verification.html).toContain('Ayu &lt;Buyer&gt;');
    expect(reset.html).toContain('Reset Password');
    expect(order.html).toContain('VIP &lt;Seat&gt;');
    expect(order.html).toContain('Rp 250.000');
    expect(eticket.html).toContain('Concert &lt;Live&gt;');
    expect(createEmailService({ EMAIL_API_KEY: 'key', EMAIL_FROM: 'from@example.com' })).toBeInstanceOf(EmailService);
  });
});