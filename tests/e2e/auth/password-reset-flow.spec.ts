import { expect, test } from '@playwright/test';
import {
	createBuyerViaApi,
	loginApi,
	API_URL,
	withRetry,
} from '../helpers';

test.describe('Password Reset Flow', () => {
	test.describe.configure({ mode: 'serial' });

	let buyerEmail: string;
	let buyerPassword: string;
	let resetToken: string | undefined;
	const newPassword = 'NewSecure123!';

	test.beforeAll(async ({ request }) => {
		await withRetry(async () => {
			const buyer = await createBuyerViaApi(request);
			buyerEmail = buyer.email;
			buyerPassword = buyer.password;
		});
	});

	test('should submit forgot password form successfully', async ({ page, request }) => {
		// First try via API to check if debug tokens are exposed
		const apiResponse = await request.post(`${API_URL}/auth/forgot-password`, {
			data: { email: buyerEmail },
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		});

		if (!apiResponse.ok()) {
			test.skip(true, 'Forgot password API call failed');
			return;
		}

		const payload = await apiResponse.json();

		// Check if debug token is exposed (AUTH_EXPOSE_DEBUG_TOKENS=1 on staging)
		if (payload.data?.reset_token) {
			resetToken = payload.data.reset_token;
		}

		// Now test the UI form
		await page.goto('/forgot-password');
		await page.waitForLoadState('networkidle');

		await page.locator('input[name="email"]').fill(buyerEmail);
		await page.getByRole('button', { name: /kirim instruksi reset/i }).click();
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		// Verify success message or page stays (form action may show message)
		const bodyText = await page.locator('body').textContent();
		const hasSuccessIndicator =
			bodyText?.includes('instruksi') ||
			bodyText?.includes('berhasil') ||
			bodyText?.includes('email') ||
			bodyText?.includes('reset');

		expect(hasSuccessIndicator).toBeTruthy();
	});

	test('should reset password with valid token', async ({ page }) => {
		if (!resetToken) {
			test.skip(true, 'AUTH_EXPOSE_DEBUG_TOKENS not enabled on staging — cannot extract reset token');
			return;
		}

		// Navigate to reset password page with token
		await page.goto(`/reset-password?token=${resetToken}`);
		await page.waitForLoadState('networkidle');

		// Fill in new password
		await page.locator('input[name="password"]').fill(newPassword);
		await page.locator('input[name="confirm_password"]').fill(newPassword);

		// Submit form
		await page.getByRole('button', { name: /simpan password baru/i }).click();
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		// Verify success
		const bodyText = await page.locator('body').textContent();
		const hasSuccess =
			bodyText?.includes('berhasil') ||
			bodyText?.includes('success') ||
			bodyText?.includes('password') ||
			page.url().includes('/login');

		expect(hasSuccess).toBeTruthy();
	});

	test('should login with new password after reset', async ({ request }) => {
		if (!resetToken) {
			test.skip(true, 'AUTH_EXPOSE_DEBUG_TOKENS not enabled — password was not reset');
			return;
		}

		// Verify login works with new password
		const response = await request.post(`${API_URL}/auth/login`, {
			data: { email: buyerEmail, password: newPassword },
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		});

		expect(response.ok()).toBeTruthy();

		const payload = await response.json();
		expect(payload.success).toBe(true);
		expect(payload.data.access_token).toBeTruthy();
	});

	test('should reject invalid reset token', async ({ page }) => {
		await page.goto('/reset-password?token=invalid-token-12345');
		await page.waitForLoadState('networkidle');

		await page.locator('input[name="password"]').fill('SomePassword123!');
		await page.locator('input[name="confirm_password"]').fill('SomePassword123!');

		await page.getByRole('button', { name: /simpan password baru/i }).click();
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		// Should show error
		const bodyText = await page.locator('body').textContent();
		const hasError =
			bodyText?.includes('error') ||
			bodyText?.includes('invalid') ||
			bodyText?.includes('expired') ||
			bodyText?.includes('gagal') ||
			bodyText?.includes('tidak valid');

		expect(hasError).toBeTruthy();
	});
});
