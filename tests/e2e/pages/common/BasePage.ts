import { expect, type Page } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) {}

  async goto(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState('networkidle');
  }

  async waitForNavigation() {
    await this.page.waitForLoadState('networkidle');
  }

  async getPageTitle() {
    return this.page.title();
  }

  async expectUrl(pattern: string | RegExp) {
    await expect(this.page).toHaveURL(pattern);
  }

  async expectVisible(selector: string) {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  async expectText(selector: string, text: string | RegExp) {
    await expect(this.page.locator(selector)).toContainText(text);
  }

  async clickButton(name: string | RegExp) {
    await this.page.getByRole('button', { name }).click();
  }

  async clickLink(name: string | RegExp) {
    await this.page.getByRole('link', { name }).click();
  }

  async fillInput(label: string | RegExp, value: string) {
    await this.page.getByLabel(label).fill(value);
  }

  async selectOption(label: string | RegExp, value: string) {
    await this.page.getByLabel(label).selectOption(value);
  }

  async checkCheckbox(label: string | RegExp) {
    await this.page.getByLabel(label).check();
  }

  async uncheckCheckbox(label: string | RegExp) {
    await this.page.getByLabel(label).uncheck();
  }

  async uploadFile(selector: string, filePath: string) {
    await this.page.locator(selector).setInputFiles(filePath);
  }

  async screenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png` });
  }

  async waitForTimeout(ms: number) {
    await this.page.waitForTimeout(ms);
  }
}
