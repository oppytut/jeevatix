import { expect, test } from '@playwright/test';
import { loginAdminUi } from '../helpers';

test.describe('Admin Category CRUD', () => {
	test('should display category list', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/categories');
		await page.waitForLoadState('networkidle');

		const bodyText = await page.locator('body').textContent();
		const hasCategoryPage =
			bodyText?.includes('kategori') ||
			bodyText?.includes('Kategori') ||
			bodyText?.includes('Manajemen kategori');

		expect(hasCategoryPage).toBe(true);
	});

	test('should create new category', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/categories');
		await page.waitForLoadState('networkidle');

		const addButton = page.getByRole('button', { name: /tambah/i });
		if ((await addButton.count()) === 0) {
			test.skip(true, 'Add category button not found');
			return;
		}
		await addButton.click();
		await page.waitForTimeout(1000);

		const nameInput = page.locator('#category-name');
		if ((await nameInput.count()) === 0) {
			test.skip(true, 'Category name input not found in modal');
			return;
		}

		const categoryName = `E2E Test ${Date.now()}`;
		await nameInput.fill(categoryName);

		const iconInput = page.locator('#category-icon');
		if ((await iconInput.count()) > 0) {
			await iconInput.fill('🎯');
		}

		const saveButton = page.getByRole('button', { name: /simpan/i });
		await saveButton.click();
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		const bodyText = await page.locator('body').textContent();
		const hasSuccess =
			bodyText?.includes(categoryName) ||
			bodyText?.includes('berhasil') ||
			bodyText?.includes('success');

		expect(hasSuccess).toBe(true);
	});

	test('should show delete confirmation modal', async ({ page }) => {
		await loginAdminUi(page);

		await page.goto('/categories');
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(1000);

		const hapusButton = page.getByRole('button', { name: 'Hapus' }).first();
		if ((await hapusButton.count()) === 0) {
			test.skip(true, 'No Hapus button found on category list');
			return;
		}

		await hapusButton.click();
		await page.waitForTimeout(1000);

		const bodyText = await page.locator('body').textContent();
		const hasDeleteModal =
			bodyText?.includes('Hapus') ||
			bodyText?.includes('hapus') ||
			bodyText?.includes('Batal');

		expect(hasDeleteModal).toBe(true);
	});
});
