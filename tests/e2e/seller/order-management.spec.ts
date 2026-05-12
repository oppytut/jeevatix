import { expect, test } from '@playwright/test';
import {
	createSellerViaApi,
	createEventViaSellerApi,
	createConfirmedOrderFixture,
	loginApi,
	loginSellerUi,
	publishEventAsAdmin,
	withRetry,
} from '../helpers';

test.describe('Seller Order Management', () => {
	test.describe.configure({ mode: 'serial' });

	let sellerEmail: string;
	let sellerPassword: string;
	let eventId: string;
	let orderId: string;
	let orderNumber: string;
	let buyerFullName: string;
	let buyerEmail: string;

	test.beforeAll(async ({ request }) => {
		await withRetry(async () => {
			// Create seller
			const seller = await createSellerViaApi(request);
			sellerEmail = seller.email;
			sellerPassword = seller.password;

			// Login and create event
			const sellerSession = await loginApi(request, sellerEmail, sellerPassword);
			const event = await createEventViaSellerApi(request, sellerSession.access_token);
			eventId = event.id;

			// Publish event as admin
			await publishEventAsAdmin(request, eventId);

			// Create confirmed order
			const orderFixture = await createConfirmedOrderFixture(
				request,
				eventId,
				sellerSession.access_token,
			);

			orderId = orderFixture.order.id;
			orderNumber = orderFixture.order.order_number;
			buyerFullName = orderFixture.buyer.fullName;
			buyerEmail = orderFixture.buyer.email;
		});
	});

	test('should display order list with orders', async ({ page }) => {
		await loginSellerUi(page, sellerEmail, sellerPassword);
		await page.goto('/orders');
		await page.waitForLoadState('networkidle');

		// Verify order list page loads
		const bodyText = await page.textContent('body');
		expect(bodyText).toBeTruthy();

		// Verify order appears in list
		expect(bodyText).toContain(orderNumber);
	});

	test('should navigate to order detail', async ({ page }) => {
		await loginSellerUi(page, sellerEmail, sellerPassword);
		await page.goto(`/orders/${orderId}`);
		await page.waitForLoadState('networkidle');

		// Verify order detail page loads with order number
		const bodyText = await page.textContent('body');
		expect(bodyText).toBeTruthy();
		expect(bodyText).toContain(orderNumber);
	});

	test('should display buyer information in order detail', async ({ page }) => {
		await loginSellerUi(page, sellerEmail, sellerPassword);
		await page.goto(`/orders/${orderId}`);
		await page.waitForLoadState('networkidle');

		// Verify buyer info is visible
		const bodyText = await page.textContent('body');
		expect(bodyText).toBeTruthy();

		// Check for buyer name or email
		const hasBuyerInfo = bodyText.includes(buyerFullName) || bodyText.includes(buyerEmail);
		expect(hasBuyerInfo).toBeTruthy();
	});

	test('should display payment status in order detail', async ({ page }) => {
		await loginSellerUi(page, sellerEmail, sellerPassword);
		await page.goto(`/orders/${orderId}`);
		await page.waitForLoadState('networkidle');

		// Verify payment info is visible
		const bodyText = await page.textContent('body');
		expect(bodyText).toBeTruthy();

		// Check for payment-related text (status or method)
		const hasPaymentInfo =
			bodyText.includes('confirmed') ||
			bodyText.includes('success') ||
			bodyText.includes('bank_transfer') ||
			bodyText.includes('Rp');
		expect(hasPaymentInfo).toBeTruthy();
	});
});
