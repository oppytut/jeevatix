import { expect, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';

const API_URL = 'http://localhost:8787';

export const ADMIN_EMAIL = 'admin@jeevatix.id';
export const ADMIN_PASSWORD = 'Admin123!';
export const BUYER_COOKIE_PREFIX = 'jeevatix_buyer_';

type AuthUser = {
  id: string;
  email: string;
  full_name: string;
  role: 'buyer' | 'seller' | 'admin';
};

type AuthPayload = {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
};

type Envelope<T> = {
  success: true;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type SellerEventDetail = {
  id: string;
  slug: string;
  title: string;
  tiers: Array<{ id: string }>;
};

type InitiatedPayment = {
  order_id: string;
  payment_id: string;
  external_ref: string;
  payment_url: string | null;
};

type CategoryRecord = {
  id: number;
  name: string;
  slug: string;
};

type BuyerTicketListItem = {
  id: string;
  ticket_code: string;
  event_id: string;
  event_title: string;
};

type ReservationPayload = {
  reservation_id: string;
  expires_at: string;
};

type OrderPayload = {
  id: string;
  order_number: string;
};

type PendingOrderFixture = {
  buyer: CreatedBuyer;
  buyerSession: AuthPayload;
  reservation: ReservationPayload;
  order: OrderPayload;
};

type CreatedSeller = {
  email: string;
  password: string;
  fullName: string;
  orgName: string;
  userId: string;
};

type CreatedBuyer = {
  email: string;
  password: string;
  fullName: string;
  userId: string;
};

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function uniqueEmail(prefix: string) {
  return `${prefix}-${uniqueSuffix()}@e2e.jeevatix.test`;
}

export function formatDateTimeLocal(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  const hours = `${value.getHours()}`.padStart(2, '0');
  const minutes = `${value.getMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export async function waitForUrl(request: APIRequestContext, url: string) {
  await expect
    .poll(
      async () => {
        try {
          const response = await request.get(url, { timeout: 5_000 });
          return response.ok();
        } catch {
          return false;
        }
      },
      {
        timeout: 120_000,
        intervals: [500, 1_000, 2_000],
      },
    )
    .toBe(true);
}

export async function waitForPortal(request: APIRequestContext, portal: 'buyer' | 'admin' | 'seller') {
  const url =
    portal === 'buyer'
      ? 'http://localhost:4301'
      : portal === 'admin'
        ? 'http://localhost:4302/login'
        : 'http://localhost:4303/login';

  await waitForUrl(request, API_URL + '/doc');
  await waitForUrl(request, url);
}

export async function ensureBaseFixtures() {
  await fetch(`${API_URL}/doc`).catch(() => undefined);
}

async function apiRequest<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: {
    token?: string;
    data?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<Envelope<T>> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.data !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await request.fetch(`${API_URL}${path}`, {
    method,
    headers,
    data: options.data,
  });
  const payload = ((await response.json()) as Envelope<T> | ErrorEnvelope);

  if (!response.ok || !('success' in payload) || payload.success !== true) {
    const errorPayload = payload as ErrorEnvelope;
    throw new Error(
      `${method} ${path} failed: ${errorPayload.error?.code ?? response.status} ${errorPayload.error?.message ?? response.statusText}`,
    );
  }

  return payload;
}

export async function loginApi(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const result = await apiRequest<AuthPayload>(request, 'POST', '/auth/login', {
    data: { email, password },
  });

  return result.data;
}

export async function getCategoryIds(request: APIRequestContext) {
  const result = await apiRequest<CategoryRecord[]>(request, 'GET', '/categories');
  return result.data.map((category) => category.id);
}

export async function listCategories(request: APIRequestContext) {
  const result = await apiRequest<CategoryRecord[]>(request, 'GET', '/categories');
  return result.data;
}

export async function createSellerViaApi(request: APIRequestContext): Promise<CreatedSeller> {
  const email = uniqueEmail('seller');
  const password = 'Seller123!';
  const fullName = `Seller ${uniqueSuffix()}`;
  const orgName = `Org ${uniqueSuffix()}`;
  const result = await apiRequest<AuthPayload>(request, 'POST', '/auth/register/seller', {
    data: {
      email,
      password,
      full_name: fullName,
      phone: '081234567890',
      org_name: orgName,
      org_description: 'Seller fixture untuk Playwright.',
    },
  });

  return {
    email,
    password,
    fullName,
    orgName,
    userId: result.data.user.id,
  };
}

export async function createBuyerViaApi(request: APIRequestContext): Promise<CreatedBuyer> {
  const email = uniqueEmail('buyer');
  const password = 'Buyer123!';
  const fullName = `Buyer ${uniqueSuffix()}`;
  const result = await apiRequest<AuthPayload>(request, 'POST', '/auth/register', {
    data: {
      email,
      password,
      full_name: fullName,
      phone: '081298765432',
    },
  });

  return {
    email,
    password,
    fullName,
    userId: result.data.user.id,
  };
}

export async function publishEventAsAdmin(
  request: APIRequestContext,
  eventId: string,
  status: 'published' | 'rejected' = 'published',
) {
  const admin = await loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD);

  await apiRequest(request, 'PATCH', `/admin/events/${eventId}/status`, {
    token: admin.access_token,
    data: { status },
  });
}

export async function createEventViaSellerApi(
  request: APIRequestContext,
  sellerAccessToken: string,
  titlePrefix = 'E2E Event',
): Promise<SellerEventDetail> {
  const categoryIds = await getCategoryIds(request);
  const now = new Date();
  const saleStart = new Date(now.getTime() - 60 * 60 * 1000);
  const saleEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const startAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const endAt = new Date(startAt.getTime() + 3 * 60 * 60 * 1000);
  const title = `${titlePrefix} ${uniqueSuffix()}`;
  const result = await apiRequest<SellerEventDetail>(request, 'POST', '/seller/events', {
    token: sellerAccessToken,
    data: {
      title,
      description: 'Event fixture yang dipakai untuk E2E Playwright.',
      venue_name: 'Istora Senayan',
      venue_address: 'Jl. Pintu Satu Senayan, Jakarta Pusat',
      venue_city: 'Jakarta',
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      sale_start_at: saleStart.toISOString(),
      sale_end_at: saleEnd.toISOString(),
      banner_url: null,
      max_tickets_per_order: 5,
      category_ids: categoryIds.slice(0, 1),
      images: [],
      tiers: [
        {
          name: 'Regular',
          description: 'Tier regular untuk E2E.',
          price: 150000,
          quota: 25,
          sort_order: 0,
          sale_start_at: saleStart.toISOString(),
          sale_end_at: saleEnd.toISOString(),
        },
      ],
    },
  });

  return result.data;
}

export async function createPublishedEventFixture(request: APIRequestContext) {
  const seller = await createSellerViaApi(request);
  const sellerSession = await loginApi(request, seller.email, seller.password);
  const event = await createEventViaSellerApi(request, sellerSession.access_token, 'Buyer Flow Event');
  await publishEventAsAdmin(request, event.id, 'published');

  return {
    seller,
    sellerSession,
    event,
  };
}

export async function createConfirmedOrderFixture(
  request: APIRequestContext,
  eventId: string,
  sellerAccessToken: string,
  buyer?: CreatedBuyer,
) {
  const pendingOrder = await createPendingOrderFixture(request, eventId, sellerAccessToken, buyer);
  const payment = await apiRequest<InitiatedPayment>(
    request,
    'POST',
    `/payments/${pendingOrder.order.id}/pay`,
    {
    token: pendingOrder.buyerSession.access_token,
    data: {
      method: 'bank_transfer',
    },
    },
  );

  await apiRequest(request, 'POST', '/webhooks/payment', {
    data: {
      external_ref: payment.data.external_ref,
      status: 'success',
      paid_at: new Date().toISOString(),
      metadata: {
        gateway: 'playwright-mock',
      },
    },
    headers: {
      'x-payment-signature': 'mock-signature',
    },
  });

  const tickets = await apiRequest<BuyerTicketListItem[]>(request, 'GET', '/tickets?page=1&limit=20', {
    token: pendingOrder.buyerSession.access_token,
  });
  const issuedTicket = tickets.data.find((ticket) => ticket.event_id === eventId) ?? tickets.data[0];

  if (!issuedTicket) {
    throw new Error(`No ticket was generated for event ${eventId}.`);
  }

  return {
    buyer: pendingOrder.buyer,
    buyerSession: pendingOrder.buyerSession,
    order: pendingOrder.order,
    payment: payment.data,
    ticket: issuedTicket,
  };
}

export async function createPendingOrderFixture(
  request: APIRequestContext,
  eventId: string,
  sellerAccessToken: string,
  buyer?: CreatedBuyer,
): Promise<PendingOrderFixture> {
  const activeBuyer = buyer ?? (await createBuyerViaApi(request));
  const buyerSession = await loginApi(request, activeBuyer.email, activeBuyer.password);
  const sellerEvent = await apiRequest<SellerEventDetail>(request, 'GET', `/seller/events/${eventId}`, {
    token: sellerAccessToken,
  });
  const reservation = await apiRequest<ReservationPayload>(request, 'POST', '/reservations', {
    token: buyerSession.access_token,
    data: {
      ticket_tier_id: sellerEvent.data.tiers[0]!.id,
      quantity: 1,
    },
  });
  const order = await apiRequest<OrderPayload>(request, 'POST', '/orders', {
    token: buyerSession.access_token,
    data: {
      reservation_id: reservation.data.reservation_id,
    },
  });

  return {
    buyer: activeBuyer,
    buyerSession,
    reservation: reservation.data,
    order: order.data,
  };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPathPattern(path: string) {
  if (path === '/') {
    return /\/$/;
  }

  return new RegExp(`${escapeRegExp(path)}(?:\\?.*)?$`);
}

export async function gotoAndExpectDocument(
  page: Page,
  path: string,
  options: {
    finalPath?: string | RegExp;
    expectedText?: string | RegExp | Array<string | RegExp>;
  } = {},
) {
  const response = await page.goto(path);
  expect(response, `No document response when navigating to ${path}`).not.toBeNull();
  expect(response?.ok(), `Document response was not OK for ${path}`).toBeTruthy();

  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(
    typeof options.finalPath === 'string'
      ? getPathPattern(options.finalPath)
      : options.finalPath ?? getPathPattern(path),
  );
  await expect(page.locator('body')).toBeVisible();

  const expectedTexts = Array.isArray(options.expectedText)
    ? options.expectedText
    : options.expectedText
      ? [options.expectedText]
      : [];

  for (const expectedText of expectedTexts) {
    await expect(page.locator('body')).toContainText(expectedText);
  }
}

export async function loginAdminUi(page: Page) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/localhost:4302\/$/);
}

export async function loginBuyerUi(page: Page, email: string, password: string) {
  await clearBuyerSession(page.context());
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/localhost:4301\/$/);
}

export async function loginSellerUi(page: Page, email: string, password: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/localhost:4303\/$/);
}

export async function clearBuyerSession(context: BrowserContext) {
  await context.clearCookies({
    name: new RegExp(`^${BUYER_COOKIE_PREFIX}`),
  });
}

export async function buyerLogoutFallback(page: Page) {
  await clearBuyerSession(page.context());
  await page.goto('/');
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Login' })).toBeVisible();
}