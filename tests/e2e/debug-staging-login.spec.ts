import { expect, test } from '@playwright/test';

test('debug staging seller login with network inspection', async ({ page }) => {
  const requests: any[] = [];
  const responses: any[] = [];

  page.on('request', request => {
    if (request.url().includes('login') || request.url().includes('auth')) {
      requests.push({
        url: request.url(),
        method: request.method(),
        headers: Object.fromEntries(
          Object.entries(request.headers()).filter(([k]) => 
            ['content-type', 'origin', 'referer'].includes(k.toLowerCase())
          )
        ),
        postData: request.postData()
      });
    }
  });

  page.on('response', async response => {
    if (response.url().includes('login') || response.url().includes('auth')) {
      const contentType = response.headers()['content-type'] || '';
      let body = '';
      try {
        if (contentType.includes('json')) {
          body = JSON.stringify(await response.json());
        } else {
          const text = await response.text();
          body = text.substring(0, 200);
        }
      } catch (e) {
        body = `[Error reading body: ${e}]`;
      }

      responses.push({
        url: response.url(),
        status: response.status(),
        contentType,
        body
      });
    }
  });

  await page.goto('https://jeevatix-staging-seller.ariefna95.workers.dev/login');
  await page.fill('input[name="email"]', 'seller@jeevatix.id');
  await page.fill('input[name="password"]', 'Seller123!');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(3000);

  console.log('\n=== REQUESTS ===');
  requests.forEach((req, i) => {
    console.log(`\nRequest ${i + 1}:`);
    console.log('  URL:', req.url);
    console.log('  Method:', req.method);
    console.log('  Headers:', JSON.stringify(req.headers, null, 2));
    if (req.postData) {
      console.log('  Body:', req.postData);
    }
  });

  console.log('\n=== RESPONSES ===');
  responses.forEach((res, i) => {
    console.log(`\nResponse ${i + 1}:`);
    console.log('  URL:', res.url);
    console.log('  Status:', res.status);
    console.log('  Content-Type:', res.contentType);
    console.log('  Body:', res.body);
  });

  const currentUrl = page.url();
  console.log('\n=== FINAL STATE ===');
  console.log('Current URL:', currentUrl);
  console.log('Login successful:', !currentUrl.includes('/login'));
});
