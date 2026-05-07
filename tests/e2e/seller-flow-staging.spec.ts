import { expect, test } from '@playwright/test';

test.describe('Seller Login on Staging', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('https://jeevatix-staging-seller.ariefna95.workers.dev/login');

    await page.fill('input[name="email"]', 'seller@jeevatix.id');
    await page.fill('input[name="password"]', 'Seller123!');

    await page.click('button[type="submit"]');

    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);

    const pageContent = await page.content();
    console.log('Page contains "Login gagal":', pageContent.includes('Login gagal'));
    console.log('Page contains "Dashboard":', pageContent.includes('Dashboard'));
    console.log('Page contains "Events":', pageContent.includes('Events'));

    if (pageContent.includes('Login gagal')) {
      const errorMessage = await page.locator('text=Login gagal').textContent();
      console.log('Error message:', errorMessage);
      
      const allText = await page.locator('body').textContent();
      console.log('Full page text (first 500 chars):', allText?.substring(0, 500));
    }

    expect(currentUrl).not.toContain('/login');
  });

  test('should show API response in network tab', async ({ page }) => {
    const requests: any[] = [];
    const responses: any[] = [];

    page.on('request', request => {
      if (request.url().includes('/auth/login')) {
        requests.push({
          url: request.url(),
          method: request.method(),
          headers: request.headers(),
          postData: request.postData()
        });
      }
    });

    page.on('response', async response => {
      if (response.url().includes('/auth/login') || response.url().includes('/login')) {
        const body = await response.text().catch(() => 'Could not read body');
        responses.push({
          url: response.url(),
          status: response.status(),
          headers: response.headers(),
          body: body.substring(0, 1000)
        });
      }
    });

    await page.goto('https://jeevatix-staging-seller.ariefna95.workers.dev/login');
    await page.fill('input[name="email"]', 'seller@jeevatix.id');
    await page.fill('input[name="password"]', 'Seller123!');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    console.log('=== REQUESTS ===');
    console.log(JSON.stringify(requests, null, 2));
    console.log('=== RESPONSES ===');
    console.log(JSON.stringify(responses, null, 2));
  });
});
