import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
	const browser = await chromium.launch();
	const page = await browser.newPage();

	console.log('🔧 Global Setup: Creating test data...');

	const useStaging = process.env.E2E_TARGET === 'staging';
	const apiBaseURL = useStaging 
		? 'https://jeevatix-staging-api.ariefna95.workers.dev' 
		: 'http://localhost:8787';

	console.log(`🌐 Using API: ${apiBaseURL}`);

	// Retry health check with exponential backoff
	const maxRetries = 10;
	const initialDelay = 1000;
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			console.log(`🔍 Health check attempt ${attempt}/${maxRetries}...`);
			const healthResponse = await page.request.get(`${apiBaseURL}/health`, {
				timeout: 5000
			});
			
			if (healthResponse.ok()) {
				console.log('✅ API health check passed');
				break;
			} else {
				throw new Error(`API returned status ${healthResponse.status()}`);
			}
		} catch (error) {
			lastError = error as Error;
			console.warn(`⚠️  Attempt ${attempt} failed: ${lastError.message}`);
			
			if (attempt < maxRetries) {
				const delay = initialDelay * Math.pow(2, attempt - 1);
				console.log(`⏳ Waiting ${delay}ms before retry...`);
				await page.waitForTimeout(delay);
			}
		}
	}

	if (lastError) {
		console.error('❌ API health check failed after all retries');
		console.error('   Tests may fail. Please ensure API is running.');
	}

	await browser.close();

	console.log('✅ Global setup complete');
}

export default globalSetup;
