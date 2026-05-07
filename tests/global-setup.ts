import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
	const browser = await chromium.launch();
	const page = await browser.newPage();

	console.log('🔧 Global Setup: Creating test data...');

	const apiBaseURL = 'http://localhost:8787';

	try {
		const healthResponse = await page.request.get(`${apiBaseURL}/health`);
		if (!healthResponse.ok()) {
			console.warn('⚠️  API not responding. Tests may fail.');
		} else {
			console.log('✅ API health check passed');
		}
	} catch (error) {
		console.warn('⚠️  Could not connect to API:', error);
	}

	await browser.close();

	console.log('✅ Global setup complete');
}

export default globalSetup;
