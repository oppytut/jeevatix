import { expect, test } from '@playwright/test';
import { loginAdminUi, withRetry } from '../helpers';

test.describe('Admin Category CRUD', () => {
	test('should display category list', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/categories');
		await page.waitForLoadState('networkidle');

		await expect(page.locator('text=Kategori Event')).toBeVisible();
		await expect(page.locator('text=Tambah Kategori')).toBeVisible();
	});

	test('should create new category', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/categories');
		await page.waitForLoadState('networkidle');

		await page.locator('text=Tambah Kategori').click();

		await withRetry(async () => {
			const modalHeading = await page.locator('text=Tambah Kategori').count();
			const nameInput = await page.locator('#category-name').count();
			expect(modalHeading + nameInput).toBeGreaterThan(0);
		});

		const categoryName = `E2E Test Category ${Date.now()}`;
		await page.locator('#category-name').fill(categoryName);
		await page.locator('#category-icon').fill('🎯');

		await page.locator('text=Simpan Kategori').click();
		await page.waitForLoadState('networkidle');

		const hasSuccess =
			(await page.locator(`text=${categoryName}`).count()) > 0 ||
			(await page.locator('text=/success|berhasil/i').count()) > 0;

		expect(hasSuccess).toBe(true);
	});

	test('should show delete confirmation modal', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/categories');
		await page.waitForLoadState('networkidle');

		const deleteButtons = await page.locator('button:has(svg)').all();
		expect(deleteButtons.length).toBeGreaterThan(0);

		await deleteButtons[0].click();

		await withRetry(async () => {
			const hasDeleteText =
				(await page.locator('text=/Hapus kategori|Hapus Permanen/i').count()) > 0;
			expect(hasDeleteText).toBe(true);
		});

		await page.locator('text=Batal').click();
	});
});
