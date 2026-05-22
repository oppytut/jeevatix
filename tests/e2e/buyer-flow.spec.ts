import { expect, test } from '@playwright/test';

import {
  buyerLogoutFallback,
  createPublishedEventFixture,
  loginBuyerUi,
  waitForPortal,
  createBuyerViaApi,
  API_URL,
  signPaymentWebhookPayload,
} from './helpers';

test.describe('Buyer E2E Flow', () => {
  test.setTimeout(240_000);

  test('register, login, browse, checkout, pay, inspect ticket and orders, logout', async ({
    page,
    request,
  }) => {
    await waitForPortal(request, 'buyer');

    const fixture = await createPublishedEventFixture(request);
    const buyer = await createBuyerViaApi(request);

    await loginBuyerUi(page, buyer.email, buyer.password);

    await expect(page.getByRole('heading', { name: /Panggung, tribun, workshop/i })).toBeVisible();
    await page.getByRole('link', { name: 'Jelajah Event' }).click();

    await expect(page).toHaveURL(/\/events/);

    await page.goto(`/events/${fixture.event.slug}`);
    await expect(page).toHaveURL(new RegExp(`/events/${fixture.event.slug}$`));
    await expect(page.getByRole('heading', { name: fixture.event.title })).toBeVisible();
    await page.goto(`/checkout/${fixture.event.slug}`);

    await expect(page).toHaveURL(new RegExp(`/checkout/${fixture.event.slug}$`));
    await page.waitForLoadState('networkidle');
    const reserveBtn = page.getByRole('button', { name: 'Reservasi Tiket' });
    await expect(reserveBtn).toBeEnabled({ timeout: 15000 });
    await reserveBtn.click();
    await expect(page.getByText('Reservasi berhasil dibuat')).toBeVisible({ timeout: 60000 });
    const payBtn = page.getByRole('button', { name: 'Lanjut ke Pembayaran' });
    await expect(payBtn).toBeVisible({ timeout: 10000 });
    await payBtn.click({ timeout: 60000 });

    await expect(page).toHaveURL(/\/payment\//, { timeout: 60000 });
    await expect(page.getByText('Ringkasan Order')).toBeVisible();
    await page.getByLabel('Bank Transfer').check();
    await page.getByRole('button', { name: 'Bayar Sekarang' }).click({ timeout: 60000 });

    await expect(page).toHaveURL(/\/mock-payment\//, { timeout: 60000 });

    const paymentUrl = new URL(page.url());
    const externalRef = paymentUrl.pathname.split('/').pop();
    expect(externalRef).toBeTruthy();

    const body = {
      external_ref: externalRef,
      status: 'success',
      paid_at: new Date().toISOString(),
      metadata: {
        gateway: 'playwright-mock',
      },
    };
    const rawBody = JSON.stringify(body);
    const signature = await signPaymentWebhookPayload(rawBody);
    await request.post(`${API_URL}/webhooks/payment`, {
      data: body,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-payment-signature': signature,
      },
    });

    await page.goto('/tickets');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Daftar tiket buyer')).toBeVisible();
    let ticketSection = page.locator('section', { hasText: fixture.event.title }).first();
    for (let attempt = 0; attempt < 5 && !(await ticketSection.isVisible().catch(() => false)); attempt++) {
      await page.waitForTimeout(2000);
      await page.reload();
      await page.waitForLoadState('networkidle');
      ticketSection = page.locator('section', { hasText: fixture.event.title }).first();
    }
    await expect(ticketSection).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await ticketSection.locator('button').last().click({ force: true });
    await expect(page).toHaveURL(/\/tickets\//);
    await expect(page.getByText('Scan-ready QR code')).toBeVisible();
    await expect(page.locator('img[alt*="QR code"]')).toBeVisible();

    await page.goto('/orders');
    await expect(page.getByText('Daftar pesanan buyer')).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(fixture.event.title, 'i') }).first()).toBeVisible();

    await buyerLogoutFallback(page);
  });
});