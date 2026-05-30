// Tier 3 — Verifies admin moderation gates buyer visibility.
// Approved events become visible to buyers, rejected events stay hidden,
// and a bulk-style approve loop publishes three pending events deterministically.
import { expect, test } from '@playwright/test';

import {
  API_URL,
  createEventViaSellerApi,
  createSellerViaApi,
  loginApi,
  publishEventAsAdmin,
  submitEventForReview,
  withRetry,
} from '../helpers';

async function expectPublicVisibility(
  request: import('@playwright/test').APIRequestContext,
  slug: string,
  shouldBeVisible: boolean,
) {
  await expect
    .poll(
      async () => {
        const response = await request.get(`${API_URL}/events/${slug}`, {
          headers: { Accept: 'application/json' },
        });
        return response.status();
      },
      {
        message: `Event ${slug} visibility should become ${shouldBeVisible}`,
        timeout: 30_000,
        intervals: [500, 1_000, 2_000],
      },
    )
    .toBe(shouldBeVisible ? 200 : 404);
}

test.describe('Tier 3 — admin moderation gates buyer visibility', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test('admin approval publishes an event that buyers can see', async ({ request }) => {
    const seller = await withRetry(() => createSellerViaApi(request));
    const sellerSession = await loginApi(request, seller.email, seller.password);
    const event = await createEventViaSellerApi(
      request,
      sellerSession.access_token,
      'Tier3 Approve Visible',
    );
    await submitEventForReview(request, event.id, sellerSession.access_token);

    await expectPublicVisibility(request, event.slug, false);
    await publishEventAsAdmin(request, event.id, 'published');
    await expectPublicVisibility(request, event.slug, true);
  });

  test('admin rejection keeps an event hidden from buyers', async ({ request }) => {
    const seller = await withRetry(() => createSellerViaApi(request));
    const sellerSession = await loginApi(request, seller.email, seller.password);
    const event = await createEventViaSellerApi(
      request,
      sellerSession.access_token,
      'Tier3 Reject Hidden',
    );
    await submitEventForReview(request, event.id, sellerSession.access_token);

    await publishEventAsAdmin(request, event.id, 'rejected');
    await expectPublicVisibility(request, event.slug, false);

    const adminSession = await loginApi(request, 'admin@jeevatix.id', 'Admin123!');
    const adminDetail = await request.get(`${API_URL}/admin/events/${event.id}`, {
      headers: {
        Authorization: `Bearer ${adminSession.access_token}`,
        Accept: 'application/json',
      },
    });
    expect(adminDetail.ok()).toBeTruthy();
    const adminBody = await adminDetail.json();
    expect(adminBody.data.status).toBe('rejected');
  });

  test('admin bulk-style approval publishes 3 pending events', async ({ request }) => {
    const seller = await withRetry(() => createSellerViaApi(request));
    const sellerSession = await loginApi(request, seller.email, seller.password);

    const events = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        createEventViaSellerApi(
          request,
          sellerSession.access_token,
          `Tier3 Bulk Approve ${index + 1}`,
        ),
      ),
    );

    await Promise.all(
      events.map((event) => submitEventForReview(request, event.id, sellerSession.access_token)),
    );

    await Promise.all(events.map((event) => publishEventAsAdmin(request, event.id, 'published')));

    for (const event of events) {
      await expectPublicVisibility(request, event.slug, true);
    }
  });
});
