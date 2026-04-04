import { expect, test } from '@playwright/test';

import {
  createConfirmedOrderFixture,
  formatDateTimeLocal,
  loginApi,
  publishEventAsAdmin,
  uniqueEmail,
  waitForPortal,
} from './helpers';

test.describe('Seller E2E Flow', () => {
  test.setTimeout(240_000);

  test('register, login, create event, inspect orders, check in ticket, logout', async ({
    page,
    request,
  }) => {
    await waitForPortal(request, 'seller');

    const sellerEmail = uniqueEmail('seller-ui');
    const sellerPassword = 'Seller123!';
    const sellerName = `Seller UI ${Date.now()}`;
    const orgName = `Seller Org ${Date.now()}`;
    const eventTitle = `Seller UI Event ${Date.now()}`;

    await page.goto('/register');
    await page.locator('#email').fill(sellerEmail);
    await page.locator('#password').fill(sellerPassword);
    await page.locator('#fullName').fill(sellerName);
    await page.locator('#phone').fill('081234567891');
    await page.locator('#orgName').fill(orgName);
    await page.locator('#orgDescription').fill('Seller studio fixture untuk Playwright.');
    await page.getByRole('button', { name: 'Daftar Seller' }).click();
    await expect(page).toHaveURL(/localhost:4303\/$/);

    await page.getByRole('button', { name: 'Logout' }).click();
    await page.context().clearCookies();
    await page.goto('/login');
    await expect(page).toHaveURL(/localhost:4303\/login/);

    await page.getByLabel('Email').fill(sellerEmail);
    await page.getByLabel('Password').fill(sellerPassword);
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page).toHaveURL(/localhost:4303\/$/);

    await page.goto('/events/create');
    await page.waitForTimeout(500);
    await page.getByLabel('Title Event').fill(eventTitle);
    await page.getByLabel('Deskripsi').fill('Event buatan seller E2E.');
    await page.getByLabel('Kota Event').fill('Jakarta');
    await page.getByRole('button', { name: 'Musik' }).click();
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await expect(page.getByLabel('Venue Name')).toBeVisible();

    const now = new Date();
    const saleStart = new Date(now.getTime() - 60 * 60 * 1000);
    const saleEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const startAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);

    await page.getByLabel('Venue Name').fill('Istora Senayan');
    await page.getByLabel('Venue Address').fill('Jl. Pintu Satu Senayan, Jakarta Pusat');
    await page.getByLabel('Latitude').fill('-6.2187');
    await page.getByLabel('Longitude').fill('106.8022');
    await page.getByLabel('Start At').fill(formatDateTimeLocal(startAt));
    await page.getByLabel('End At').fill(formatDateTimeLocal(endAt));
    await page.getByLabel('Sale Start').fill(formatDateTimeLocal(saleStart));
    await page.getByLabel('Sale End').fill(formatDateTimeLocal(saleEnd));
    await page.getByLabel('Max Tickets per Order').fill('5');
    await page.getByRole('button', { name: 'Lanjut' }).click();

    await page.getByRole('button', { name: 'Lanjut' }).click();
    await expect(page.getByLabel('Nama Tier')).toBeVisible();

    await page.getByLabel('Nama Tier').fill('Regular');
    await page.locator('textarea[id^="tier-description-"]').fill('Tier regular seller flow.');
    await page.getByLabel('Harga').fill('175000');
    await page.getByLabel('Quota').fill('20');
    await page.getByLabel('Sale Start Tier').fill(formatDateTimeLocal(saleStart));
    await page.getByLabel('Sale End Tier').fill(formatDateTimeLocal(saleEnd));
    await page.getByRole('button', { name: 'Lanjut' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Simpan Event Draft' }).click();

    await expect(page).toHaveURL(/localhost:4303\/events\/(?!create$)[^/]+$/);
    await expect(page.getByRole('heading', { name: eventTitle })).toBeVisible();

    const eventId = page.url().split('/').pop();
    expect(eventId).toBeTruthy();

    await page.goto('/events');
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Refresh' }).click();
    await expect(page.getByText(eventTitle).first()).toBeVisible();

    await publishEventAsAdmin(request, eventId!);
    const sellerSession = await loginApi(request, sellerEmail, sellerPassword);
    const orderFixture = await createConfirmedOrderFixture(request, eventId!, sellerSession.access_token);

    await page.goto('/orders');
    await expect(page.getByText('Seller order board')).toBeVisible();
    await expect(page.getByText(orderFixture.order.order_number)).toBeVisible();

    await page.goto(`/events/${eventId}/checkin`);
    await expect(page.getByText('Check-in scanner')).toBeVisible();
    await page.locator('#ticket-code').fill(orderFixture.ticket.ticket_code);
    await page.getByRole('button', { name: 'Check-in' }).click();
    await expect(page.getByText('Valid', { exact: true })).toBeVisible();
    await expect(page.getByText(orderFixture.ticket.ticket_code).first()).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();
    await page.context().clearCookies();
    await page.goto('/login');
    await expect(page).toHaveURL(/localhost:4303\/login/);
  });
});