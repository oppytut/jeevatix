import { test } from '@playwright/test';
import percySnapshot from '@percy/playwright';

/**
 * Visual Regression Tests using Percy
 * 
 * These tests capture visual snapshots of critical pages and compare them
 * against baseline images to detect unintended visual changes.
 * 
 * Setup:
 * 1. Sign up for Percy at https://percy.io
 * 2. Get your PERCY_TOKEN from project settings
 * 3. Set PERCY_TOKEN environment variable
 * 4. Run: npx percy exec -- playwright test visual-regression.spec.ts
 * 
 * First run will create baseline snapshots.
 * Subsequent runs will compare against baselines and flag differences.
 */

test.describe('Visual Regression - Buyer Portal', () => {
	const baseURL = 'baseURL';

	test('Homepage - Desktop', async ({ page }) => {
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');
		
		// Wait for dynamic content to load
		await page.waitForSelector('h1', { timeout: 5000 });
		
		await percySnapshot(page, 'Buyer Homepage - Desktop');
	});

	test('Homepage - Mobile', async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto(baseURL);
		await page.waitForLoadState('networkidle');
		await page.waitForSelector('h1', { timeout: 5000 });
		
		await percySnapshot(page, 'Buyer Homepage - Mobile');
	});

	test('Events Listing Page', async ({ page }) => {
		await page.goto(`${baseURL}/events`);
		await page.waitForLoadState('networkidle');
		
		// Wait for event cards to load
		await page.waitForSelector('[data-testid="event-card"], .event-card, article', { 
			timeout: 5000,
			state: 'visible'
		}).catch(() => {
			// If no events, that's okay - we'll snapshot the empty state
		});
		
		await percySnapshot(page, 'Events Listing Page');
	});

	test('Event Detail Page', async ({ page }) => {
		// First, get an event from the listing
		await page.goto(`${baseURL}/events`);
		await page.waitForLoadState('networkidle');
		
		// Try to find and click first event
		const eventLink = page.locator('a[href*="/events/"]').first();
		const hasEvents = await eventLink.count() > 0;
		
		if (hasEvents) {
			await eventLink.click();
			await page.waitForLoadState('networkidle');
			
			// Wait for event details to load
			await page.waitForSelector('h1', { timeout: 5000 });
			
			await percySnapshot(page, 'Event Detail Page');
		} else {
			test.skip('No events available for visual testing');
		}
	});

	test('Login Page', async ({ page }) => {
		await page.goto(`${baseURL}/login`);
		await page.waitForLoadState('networkidle');
		
		await percySnapshot(page, 'Login Page');
	});

	test('Register Page', async ({ page }) => {
		await page.goto(`${baseURL}/register`);
		await page.waitForLoadState('networkidle');
		
		await percySnapshot(page, 'Register Page');
	});
});

test.describe('Visual Regression - Admin Portal', () => {
	const baseURL = 'baseURL';

	test('Admin Login Page', async ({ page }) => {
		await page.goto(`${baseURL}/login`);
		await page.waitForLoadState('networkidle');
		
		await percySnapshot(page, 'Admin Login Page');
	});
});

test.describe('Visual Regression - Seller Portal', () => {
	const baseURL = 'baseURL';

	test('Seller Login Page', async ({ page }) => {
		await page.goto(`${baseURL}/login`);
		await page.waitForLoadState('networkidle');
		
		await percySnapshot(page, 'Seller Login Page');
	});

	test('Seller Register Page', async ({ page }) => {
		await page.goto(`${baseURL}/register`);
		await page.waitForLoadState('networkidle');
		
		await percySnapshot(page, 'Seller Register Page');
	});
});

test.describe('Visual Regression - Responsive Design', () => {
	const baseURL = 'baseURL';
	const viewports = [
		{ name: 'Mobile', width: 375, height: 667 },
		{ name: 'Tablet', width: 768, height: 1024 },
		{ name: 'Desktop', width: 1920, height: 1080 },
	];

	for (const viewport of viewports) {
		test(`Homepage - ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
			await page.setViewportSize({ width: viewport.width, height: viewport.height });
			await page.goto(baseURL);
			await page.waitForLoadState('networkidle');
			await page.waitForSelector('h1', { timeout: 5000 });
			
			await percySnapshot(page, `Homepage - ${viewport.name}`);
		});
	}
});

test.describe('Visual Regression - Component States', () => {
	const baseURL = 'baseURL';

	test('Form Validation States', async ({ page }) => {
		await page.goto(`${baseURL}/login`);
		await page.waitForLoadState('networkidle');
		
		// Trigger validation errors
		await page.fill('input[type="email"]', 'invalid-email');
		await page.fill('input[type="password"]', '123');
		await page.click('button[type="submit"]');
		
		// Wait for validation messages
		await page.waitForTimeout(500);
		
		await percySnapshot(page, 'Login Form - Validation Errors');
	});

	test('Loading States', async ({ page }) => {
		await page.goto(baseURL);
		
		// Capture loading state (if visible)
		await percySnapshot(page, 'Homepage - Loading State', {
			waitForTimeout: 100 // Capture quickly before content loads
		});
	});
});
