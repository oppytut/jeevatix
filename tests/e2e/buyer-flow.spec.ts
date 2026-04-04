import { expect, test } from '@playwright/test';

import {
  buyerLogoutFallback,
  clearBuyerSession,
  createPublishedEventFixture,
  uniqueEmail,
  waitForPortal,
} from './helpers';

test.describe('Buyer E2E Flow', () => {
  test.setTimeout(240_000);

  test('register, login, browse, checkout, pay, inspect ticket and orders, logout', async ({
    page,
    request,
  }) => {
    await waitForPortal(request, 'buyer');

    const fixture = await createPublishedEventFixture(request);
    const buyerEmail = uniqueEmail('buyer-ui');
    const buyerPassword = 'Buyer123!';
    const buyerName = `Buyer UI ${Date.now()}`;

    await page.goto('/register');
    await page.getByLabel('Email').fill(buyerEmail);
    await page.getByLabel('Password').fill(buyerPassword);
    await page.getByLabel('Nama Lengkap').fill(buyerName);
    await page.getByLabel('Nomor Telepon').fill('081298765433');
    await page.getByRole('button', { name: 'Daftar Sekarang' }).click();
    await expect(page).toHaveURL(/localhost:4301\/$/);

    await clearBuyerSession(page.context());
    await page.goto('/login');
    await page.getByLabel('Email').fill(buyerEmail);
    await page.getByLabel('Password').fill(buyerPassword);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/localhost:4301\/$/);

    await expect(page.getByRole('heading', { name: /Panggung, tribun, workshop/i })).toBeVisible();
    await expect(page.getByText('Upcoming Picks')).toBeVisible();
    await page.getByRole('link', { name: 'Jelajah Event' }).click();

    await expect(page).toHaveURL(/localhost:4301\/events/);
    await page.getByRole('link', { name: new RegExp(fixture.event.title, 'i') }).first().click();

    await expect(page).toHaveURL(new RegExp(`/events/${fixture.event.slug}$`));
    await expect(page.getByRole('heading', { name: fixture.event.title })).toBeVisible();
    await page.goto(`/checkout/${fixture.event.slug}`);

    await expect(page).toHaveURL(new RegExp(`/checkout/${fixture.event.slug}$`));
    await page.getByRole('button', { name: 'Reservasi Tiket' }).click();
    await expect(page.getByText('Reservasi berhasil dibuat')).toBeVisible();
    await page.getByRole('button', { name: 'Lanjut ke Pembayaran' }).click();

    await expect(page).toHaveURL(/localhost:4301\/payment\//);
    await expect(page.getByText('Ringkasan Order')).toBeVisible();
    await page.getByLabel('Bank Transfer').check();
    await page.getByRole('button', { name: 'Bayar Sekarang' }).click();

    await expect(page).toHaveURL(/^http:\/\/localhost:8787\/mock-payment\//);

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
    await request.post('http://localhost:8787/webhooks/payment', {
      data: body,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-payment-signature': 'mock-signature',
      },
    });

    await page.goto('/tickets');
    await expect(page.getByText('Daftar tiket buyer')).toBeVisible();
    const ticketSection = page.locator('section', { hasText: fixture.event.title }).first();
    await expect(ticketSection).toBeVisible();
    await page.waitForTimeout(500);
    await ticketSection.locator('button').last().click({ force: true });
    await expect(page).toHaveURL(/localhost:4301\/tickets\//);
    await expect(page.getByText('Scan-ready QR code')).toBeVisible();
    await expect(page.locator('img[alt*="QR code"]')).toBeVisible();

    await page.goto('/orders');
    await expect(page.getByText('Daftar pesanan buyer')).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(fixture.event.title, 'i') }).first()).toBeVisible();

    await buyerLogoutFallback(page);
  });
});