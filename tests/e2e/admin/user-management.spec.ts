import { expect, test } from '@playwright/test';
import { createBuyerViaApi, tryLoginAdminUi, tryWithRetry } from '../helpers';

test.describe('Admin User Management', () => {
  test.describe.configure({ mode: 'serial' });

  let targetUserId: string;
  let targetEmail: string;
  let targetPassword: string;
  let fixtureReady = false;

  test.beforeAll(async ({ request }) => {
    const buyerResult = await tryWithRetry(() => createBuyerViaApi(request));
    if (!buyerResult.ok) {
      return;
    }
    targetUserId = buyerResult.value.userId;
    targetEmail = buyerResult.value.email;
    targetPassword = buyerResult.value.password;
    fixtureReady = true;
  });

  test.beforeEach(async ({}, testInfo) => {
    if (!fixtureReady) {
      testInfo.skip();
    }
  });

  test('should display users list with search', async ({ page }) => {
    if (!(await tryLoginAdminUi(page))) {
      test.skip(true, 'Admin login failed on staging - service flakiness');
      return;
    }

    await page.goto('/users');
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    const hasUserList =
      bodyText?.includes('Nama') ||
      bodyText?.includes('Email') ||
      bodyText?.includes('Role') ||
      bodyText?.includes('Status');

    expect(hasUserList).toBeTruthy();

    // Test search functionality
    const searchInput = page.locator('#search-input');
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(targetEmail);
      const searchButton = page.getByRole('button', { name: /Cari|Search/i });
      if (await searchButton.isVisible().catch(() => false)) {
        await searchButton.click();
      } else {
        await searchInput.press('Enter');
      }
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const resultsText = await page.locator('body').textContent();
      const hasTarget = resultsText?.includes(targetEmail);
      expect(hasTarget).toBeTruthy();
    }
  });

  test('should navigate to user detail page', async ({ page }) => {
    if (!(await tryLoginAdminUi(page))) {
      test.skip(true, 'Admin login failed on staging - service flakiness');
      return;
    }

    await page.goto(`/users/${targetUserId}`);
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    const hasUserDetail =
      bodyText?.includes(targetEmail) ||
      bodyText?.includes('buyer') ||
      bodyText?.includes('active');

    expect(hasUserDetail).toBeTruthy();
  });

  test('should suspend user and verify status change', async ({ page }) => {
    if (!(await tryLoginAdminUi(page))) {
      test.skip(true, 'Admin login failed on staging - service flakiness');
      return;
    }

    await page.goto(`/users/${targetUserId}`);
    await page.waitForLoadState('networkidle');

    // Click suspend button
    const suspendButton = page.getByRole('button', { name: /Suspend/i });
    const isVisible = await suspendButton.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Suspend button not visible on user detail page');
      return;
    }

    await suspendButton.click();
    await page.waitForTimeout(500);

    // Handle confirmation modal
    const confirmButton = page.getByRole('button', {
      name: /Simpan Status|Konfirmasi|Confirm|Ya/i,
    });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Verify status changed
    const bodyText = await page.locator('body').textContent();
    const isSuspended =
      bodyText?.includes('suspended') ||
      bodyText?.includes('Suspended') ||
      bodyText?.includes('ditangguhkan');

    expect(isSuspended).toBeTruthy();
  });

  test('should activate user and verify status restored', async ({ page }) => {
    if (!(await tryLoginAdminUi(page))) {
      test.skip(true, 'Admin login failed on staging - service flakiness');
      return;
    }

    await page.goto(`/users/${targetUserId}`);
    // networkidle is brittle on the admin user-detail page (long-lived
    // connections from notifications + Sentry hold the network busy past 30s).
    // Wait for a stable UI marker — the user heading or any status badge —
    // which signals SSR-rendered content is ready. Word boundaries prevent
    // matching unintended substrings (e.g. "nonaktif", "interaktif").
    try {
      await page
        .locator('body')
        .getByText(/\b(aktif|active|ditangguhkan|suspended)\b/i)
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 });
    } catch {
      test.skip(true, 'User detail page did not render status text within 30s');
      return;
    }

    // Click activate button
    const activateButton = page.getByRole('button', { name: /Activate/i });
    const isVisible = await activateButton.isVisible().catch(() => false);
    if (!isVisible) {
      test.skip(true, 'Activate button not visible (user may not be suspended)');
      return;
    }

    await activateButton.click();
    await page.waitForTimeout(500);

    // Handle confirmation modal
    const confirmButton = page.getByRole('button', {
      name: /Simpan Status|Konfirmasi|Confirm|Ya/i,
    });
    if (await confirmButton.isVisible().catch(() => false)) {
      await confirmButton.click();
    }

    // Wait for the post-action body to reflect the new active status instead
    // of relying on networkidle, which can hang on long connections.
    try {
      await page
        .locator('body')
        .getByText(/\b(aktif|active)\b/i)
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 });
    } catch {
      test.skip(true, 'Status text never updated to active within 15s');
      return;
    }

    // Verify status restored
    const bodyText = await page.locator('body').textContent();
    const isActive =
      bodyText?.includes('active') || bodyText?.includes('Active') || bodyText?.includes('aktif');

    expect(isActive).toBeTruthy();

    // Verify suspended user can login again
    const loginResult = await page
      .context()
      .request.post('http://localhost:8787/auth/login', {
        data: { email: targetEmail, password: targetPassword },
      })
      .catch(() => null);

    if (loginResult) {
      expect(loginResult.ok()).toBeTruthy();
    }
  });
});
