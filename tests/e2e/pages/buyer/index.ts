import { expect, type Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class BuyerLoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.goto('/login');
  }

  async login(email: string, password: string) {
    await this.fillInput(/email/i, email);
    await this.fillInput(/password/i, password);
    await this.clickButton(/login/i);
    await this.waitForNavigation();
  }

  async expectLoginSuccess() {
    await this.expectUrl(/\/$/);
  }

  async expectLoginError(message?: string | RegExp) {
    if (message) {
      await this.expectText('body', message);
    }
    await this.expectUrl(/\/login/);
  }

  async clickForgotPassword() {
    await this.clickLink(/lupa.*password|forgot.*password/i);
  }

  async clickRegister() {
    await this.clickLink(/daftar|register/i);
  }
}

export class BuyerRegisterPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.goto('/register');
  }

  async register(data: {
    email: string;
    password: string;
    confirmPassword: string;
    fullName: string;
    phone?: string;
  }) {
    await this.fillInput(/email/i, data.email);
    await this.fillInput(/^password$/i, data.password);
    await this.fillInput(/konfirmasi.*password|confirm.*password/i, data.confirmPassword);
    await this.fillInput(/nama.*lengkap|full.*name/i, data.fullName);
    
    if (data.phone) {
      await this.fillInput(/phone|telepon/i, data.phone);
    }

    await this.clickButton(/daftar|register/i);
    await this.waitForNavigation();
  }

  async expectRegistrationSuccess() {
    await this.expectUrl(/\/login|\/verify-email/);
  }

  async expectValidationError(field: string) {
    const errorLocator = this.page.locator(`[aria-invalid="true"]`);
    await expect(errorLocator).toBeVisible();
  }
}

export class BuyerHomePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.goto('/');
  }

  async searchEvents(query: string) {
    await this.fillInput(/cari|search/i, query);
    await this.page.keyboard.press('Enter');
    await this.waitForNavigation();
  }

  async clickEvent(eventTitle: string) {
    await this.page.getByText(eventTitle).first().click();
    await this.waitForNavigation();
  }

  async clickCategory(categoryName: string) {
    await this.page.getByText(categoryName).click();
    await this.waitForNavigation();
  }

  async expectFeaturedEvents() {
    await this.expectVisible('[data-featured-events]');
  }

  async getEventCount() {
    return this.page.locator('[data-event-card]').count();
  }
}

export class BuyerEventDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToEvent(slug: string) {
    await this.goto(`/events/${slug}`);
  }

  async clickBuyButton() {
    await this.clickButton(/beli|buy|pesan/i);
    await this.waitForNavigation();
  }

  async expectEventDetails() {
    await this.expectVisible('[data-event-title]');
    await this.expectVisible('[data-event-description]');
    await this.expectVisible('[data-event-date]');
    await this.expectVisible('[data-event-location]');
  }

  async getTierCount() {
    return this.page.locator('[data-tier-card]').count();
  }

  async getTierPrice(tierName: string) {
    const tierCard = this.page.locator(`[data-tier-card]:has-text("${tierName}")`);
    const priceText = await tierCard.locator('[data-tier-price]').textContent();
    return priceText;
  }
}

export class BuyerCheckoutPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToCheckout(eventSlug: string) {
    await this.goto(`/checkout/${eventSlug}`);
  }

  async selectTier(tierId: string, quantity: number) {
    const tierCard = this.page.locator(`[data-tier-id="${tierId}"]`);
    await tierCard.locator('button:has-text("Pilih")').click();
    
    const quantityInput = this.page.locator('input[type="number"]').first();
    await quantityInput.fill(quantity.toString());
  }

  async proceedToPayment() {
    await this.clickButton(/lanjut.*bayar|proceed.*payment/i);
    await this.waitForNavigation();
  }

  async expectCheckoutPage() {
    await this.expectUrl(/\/checkout\//);
  }

  async expectCountdownTimer() {
    await this.expectVisible('[data-countdown]');
  }

  async getCountdownTime() {
    const countdown = this.page.locator('[data-countdown]');
    return countdown.textContent();
  }
}

export class BuyerPaymentPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigateToPayment(orderId: string) {
    await this.goto(`/payment/${orderId}`);
  }

  async selectPaymentMethod(method: string) {
    await this.page.locator(`[data-payment-method="${method}"]`).click();
  }

  async submitPayment() {
    await this.clickButton(/bayar|pay/i);
    await this.waitForNavigation();
  }

  async expectOrderSummary() {
    await this.expectVisible('[data-order-summary]');
  }

  async expectPaymentMethods() {
    await this.expectVisible('[data-payment-methods]');
  }

  async getTotalAmount() {
    const totalElement = this.page.locator('[data-total-amount]');
    return totalElement.textContent();
  }
}

export class BuyerOrdersPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.goto('/orders');
  }

  async filterByStatus(status: string) {
    await this.selectOption(/status/i, status);
    await this.waitForNavigation();
  }

  async clickOrder(orderId: string) {
    await this.page.locator(`[data-order-id="${orderId}"]`).click();
    await this.waitForNavigation();
  }

  async getOrderCount() {
    return this.page.locator('[data-order-card]').count();
  }

  async expectNoOrders() {
    await this.expectText('body', /tidak.*ada.*pesanan|no.*orders/i);
  }
}

export class BuyerTicketsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async navigate() {
    await this.goto('/tickets');
  }

  async clickTicket(ticketId: string) {
    await this.page.locator(`[data-ticket-id="${ticketId}"]`).click();
    await this.waitForNavigation();
  }

  async getTicketCount() {
    return this.page.locator('[data-ticket-card]').count();
  }

  async expectQRCode(ticketId: string) {
    const ticketCard = this.page.locator(`[data-ticket-id="${ticketId}"]`);
    await expect(ticketCard.locator('[data-qr-code]')).toBeVisible();
  }
}
