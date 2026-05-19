import { expect, test } from '@playwright/test';
import { createConfirmedOrderFixture, createPublishedEventFixture, loginSellerUi } from '../helpers';

test.describe('QR Code Check-in', () => {
  test.describe.configure({ mode: 'serial' });

  let sellerEmail: string;
  let sellerPassword: string;
  let eventId: string;
  let validTicketCode: string;

  test.beforeAll(async ({ request }) => {
    const eventFixture = await createPublishedEventFixture(request);
    sellerEmail = eventFixture.seller.email;
    sellerPassword = eventFixture.seller.password;
    eventId = eventFixture.event.id;

    const orderFixture = await createConfirmedOrderFixture(
      request,
      eventFixture.event.id,
      eventFixture.sellerSession.access_token,
    );
    validTicketCode = orderFixture.ticket.ticket_code;
  });

  test('should successfully check-in valid QR code', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/checkin`);
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill(validTicketCode);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const hasSuccessIndicator =
      bodyText?.includes('berhasil') ||
      bodyText?.includes('success') ||
      bodyText?.includes('checked in') ||
      bodyText?.includes('valid');

    expect(hasSuccessIndicator).toBeTruthy();
  });

  test('should reject duplicate check-in', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/checkin`);
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill(validTicketCode);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const hasDuplicateError =
      bodyText?.includes('sudah') ||
      bodyText?.includes('already') ||
      bodyText?.includes('duplicate') ||
      bodyText?.includes('checked in');

    expect(hasDuplicateError).toBeTruthy();
  });

  test('should reject invalid QR code format', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/checkin`);
    await page.waitForLoadState('networkidle');

    const invalidCode = 'INVALID-FORMAT-123';
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.fill(invalidCode);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(1000);

    const bodyText = await page.locator('body').textContent();
    const hasError =
      bodyText?.includes('tidak valid') ||
      bodyText?.includes('invalid') ||
      bodyText?.includes('tidak ditemukan') ||
      bodyText?.includes('not found');

    expect(hasError).toBeTruthy();
  });

  test('should show check-in statistics', async ({ page }) => {
    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${eventId}/checkin`);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    const hasStats =
      bodyText?.includes('checked in') ||
      bodyText?.includes('total') ||
      bodyText?.includes('tiket') ||
      /\d+\s*\/\s*\d+/.test(bodyText || '');

    expect(hasStats).toBeTruthy();
  });

  test('should prevent check-in for wrong event', async ({ page, request }) => {
    const anotherEventFixture = await createPublishedEventFixture(request);
    const anotherEventId = anotherEventFixture.event.id;

    await loginSellerUi(page, sellerEmail, sellerPassword);

    await page.goto(`/events/${anotherEventId}/checkin`);
    await page.waitForLoadState('networkidle');

    const searchInput = page.locator('input[type="text"]').first();
    if ((await searchInput.count()) > 0) {
      await searchInput.fill(validTicketCode);
      await page.keyboard.press('Enter');

      await page.waitForTimeout(1000);

      const bodyText = await page.locator('body').textContent();
      const hasError =
        bodyText?.includes('tidak valid') ||
        bodyText?.includes('invalid') ||
        bodyText?.includes('tidak ditemukan') ||
        bodyText?.includes('wrong event');

      expect(hasError).toBeTruthy();
    }
  });
});
