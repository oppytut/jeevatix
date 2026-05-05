import { expect, test } from '@playwright/test';

test.describe('Staging Seller Login', () => {
  test('should login successfully with valid credentials', async ({ page }) => {
    await page.goto('https://seller.jeevatix.my.id/login');

    await page.fill('input[name="email"]', 'seller@jeevatix.id');
    await page.fill('input[name="password"]', 'Seller123!');

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/login') && response.request().method() === 'POST',
    );

    await page.click('button[type="submit"]');

    const response = await responsePromise;
    console.log('Login response status:', response.status());
    console.log('Login response URL:', response.url());

    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    console.log('Current URL after login:', currentUrl);

    if (currentUrl.includes('/login')) {
      console.log('Still on login page - login failed');
      const pageContent = await page.content();
      if (pageContent.includes('Login gagal')) {
        const errorMessage = await page.locator('text=Login gagal').textContent();
        console.log('Error message:', errorMessage);
      }
      await page.screenshot({ path: '/tmp/seller-login-failed.png' });
    } else {
      console.log('Redirected away from login - login successful');
      await page.screenshot({ path: '/tmp/seller-login-success.png' });
    }

    expect(currentUrl).not.toContain('/login');
  });

  test('should show API response on direct API call', async ({ request }) => {
    const response = await request.post(
      'https://api.jeevatix.my.id/auth/login',
      {
        data: {
          email: 'seller@jeevatix.id',
          password: 'Seller123!',
        },
      },
    );

    console.log('Direct API call status:', response.status());
    const body = await response.json();
    console.log('Direct API response:', JSON.stringify(body, null, 2));

    expect(response.status()).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.user.role).toBe('seller');
  });
});
