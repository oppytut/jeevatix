import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const { API_BASE_URL } = await import('$lib/auth');
  
  // Test fetch to API
  let fetchResult = null;
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email: 'seller@jeevatix.id',
        password: 'Seller123!'
      })
    });
    
    fetchResult = {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      ok: response.ok,
      bodyPreview: (await response.text()).substring(0, 200)
    };
  } catch (error) {
    fetchResult = {
      error: error instanceof Error ? error.message : String(error)
    };
  }
  
  return new Response(JSON.stringify({
    API_BASE_URL,
    env: {
      dev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
    },
    fetchTest: fetchResult
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
