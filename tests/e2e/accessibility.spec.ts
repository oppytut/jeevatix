import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility - Buyer Portal', () => {
	const baseURL = 'http://localhost:4301';

	test('Homepage should not have accessibility violations', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Events listing should not have accessibility violations', async ({ page }) => {
		await page.goto(`${baseURL}/events`);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Login page should not have accessibility violations', async ({ page }) => {
		await page.goto(`${baseURL}/login`);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Register page should not have accessibility violations', async ({ page }) => {
		await page.goto(`${baseURL}/register`);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Event detail page should not have accessibility violations', async ({ page }) => {
		await page.goto(`${baseURL}/events`);
		await page.waitForLoadState('networkidle');

		const eventLink = page.locator('a[href*="/events/"]').first();
		const hasEvents = (await eventLink.count()) > 0;

		if (hasEvents) {
			await eventLink.click();
			await page.waitForLoadState('networkidle');

			const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

			expect(accessibilityScanResults.violations).toEqual([]);
		} else {
			test.skip('No events available for accessibility testing');
		}
	});
});

test.describe('Accessibility - Admin Portal', () => {
	const baseURL = 'http://localhost:4302';

	test('Admin login page should not have accessibility violations', async ({ page }) => {
		await page.goto(`${baseURL}/login`);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});
});

test.describe('Accessibility - Seller Portal', () => {
	const baseURL = 'http://localhost:4303';

	test('Seller login page should not have accessibility violations', async ({ page }) => {
		await page.goto(`${baseURL}/login`);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Seller register page should not have accessibility violations', async ({ page }) => {
		await page.goto(`${baseURL}/register`);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});
});

test.describe('Accessibility - WCAG Compliance Levels', () => {
	const baseURL = 'http://localhost:4301';

	test('Homepage - WCAG 2.1 Level A compliance', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag21a'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Homepage - WCAG 2.1 Level AA compliance', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(['wcag2aa', 'wcag21aa'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Homepage - Best practices', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(['best-practice'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});
});

test.describe('Accessibility - Specific Rules', () => {
	const baseURL = 'http://localhost:4301';

	test('Forms should have proper labels', async ({ page }) => {
		await page.goto(`${baseURL}/login`);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page })
			.include('form')
			.withRules(['label', 'label-title-only'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Images should have alt text', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withRules(['image-alt'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Color contrast should meet WCAG standards', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withRules(['color-contrast'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Buttons should have accessible names', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withRules(['button-name'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test('Links should have discernible text', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');

		const accessibilityScanResults = await new AxeBuilder({ page })
			.withRules(['link-name'])
			.analyze();

		expect(accessibilityScanResults.violations).toEqual([]);
	});
});

test.describe('Accessibility - Keyboard Navigation', () => {
	const baseURL = 'http://localhost:4301';

	test('Login form should be keyboard navigable', async ({ page }) => {
		await page.goto(`${baseURL}/login`);
		await page.waitForLoadState('networkidle');

		await page.keyboard.press('Tab');
		const emailFocused = await page.evaluate(() => {
			const activeElement = document.activeElement;
			return activeElement?.getAttribute('type') === 'email' || 
			       activeElement?.getAttribute('name')?.includes('email');
		});

		expect(emailFocused).toBeTruthy();

		await page.keyboard.press('Tab');
		const passwordFocused = await page.evaluate(() => {
			const activeElement = document.activeElement;
			return activeElement?.getAttribute('type') === 'password';
		});

		expect(passwordFocused).toBeTruthy();
	});

	test('Navigation should be keyboard accessible', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');

		await page.keyboard.press('Tab');
		const firstLinkFocused = await page.evaluate(() => {
			const activeElement = document.activeElement;
			return activeElement?.tagName === 'A' || activeElement?.tagName === 'BUTTON';
		});

		expect(firstLinkFocused).toBeTruthy();
	});
});
