import { expect, test } from '@playwright/test';

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  API_URL,
  createEventViaSellerApi,
  createSellerViaApi,
  loginApi,
  publishEventAsAdmin,
  submitEventForReview,
  withRetry,
} from '../helpers';

test.describe('Tier 3 — admin moderation gates public visibility', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);

  test('draft event is NOT publicly visible until admin sets status=published', async ({
    request,
  }) => {
    const seller = await withRetry(() => createSellerViaApi(request));
    const sellerSession = await withRetry(() => loginApi(request, seller.email, seller.password));
    const event = await createEventViaSellerApi(
      request,
      sellerSession.access_token,
      'Tier3 Mod Approve',
    );

    const draftPublic = await request.get(`${API_URL}/events/${event.slug}`, {
      headers: { Accept: 'application/json' },
    });
    expect(draftPublic.ok()).toBe(false);
    expect([403, 404]).toContain(draftPublic.status());

    await submitEventForReview(request, event.id, sellerSession.access_token);

    const pendingPublic = await request.get(`${API_URL}/events/${event.slug}`, {
      headers: { Accept: 'application/json' },
    });
    expect(pendingPublic.ok()).toBe(false);
    expect([403, 404]).toContain(pendingPublic.status());

    await publishEventAsAdmin(request, event.id, 'published');

    const publishedPublic = await request.get(`${API_URL}/events/${event.slug}`, {
      headers: { Accept: 'application/json' },
    });
    expect(publishedPublic.ok()).toBeTruthy();
    const publishedBody = await publishedPublic.json();
    expect(publishedBody.success).toBe(true);
    expect(publishedBody.data.slug).toBe(event.slug);
    expect(publishedBody.data.status).toBe('published');
  });

  test('rejected event remains hidden from public buyer endpoints', async ({ request }) => {
    const seller = await withRetry(() => createSellerViaApi(request));
    const sellerSession = await withRetry(() => loginApi(request, seller.email, seller.password));
    const event = await createEventViaSellerApi(
      request,
      sellerSession.access_token,
      'Tier3 Mod Reject',
    );

    await submitEventForReview(request, event.id, sellerSession.access_token);
    await publishEventAsAdmin(request, event.id, 'rejected');

    const publicResponse = await request.get(`${API_URL}/events/${event.slug}`, {
      headers: { Accept: 'application/json' },
    });
    expect(publicResponse.ok()).toBe(false);
    expect([403, 404]).toContain(publicResponse.status());

    const adminSession = await withRetry(() => loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD));
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

  test('admin can re-publish a previously rejected event and it becomes visible', async ({
    request,
  }) => {
    const seller = await withRetry(() => createSellerViaApi(request));
    const sellerSession = await withRetry(() => loginApi(request, seller.email, seller.password));
    const event = await createEventViaSellerApi(
      request,
      sellerSession.access_token,
      'Tier3 Mod Flip',
    );

    await submitEventForReview(request, event.id, sellerSession.access_token);
    await publishEventAsAdmin(request, event.id, 'rejected');
    await publishEventAsAdmin(request, event.id, 'published');

    const publicResponse = await request.get(`${API_URL}/events/${event.slug}`, {
      headers: { Accept: 'application/json' },
    });
    expect(publicResponse.ok()).toBeTruthy();
    const body = await publicResponse.json();
    expect(body.data.status).toBe('published');
  });

  test('admin moderates 3 events sequentially → only published one is publicly visible', async ({
    request,
  }) => {
    const seller = await withRetry(() => createSellerViaApi(request));
    const sellerSession = await withRetry(() => loginApi(request, seller.email, seller.password));

    const events = await Promise.all([
      createEventViaSellerApi(request, sellerSession.access_token, 'Tier3 Bulk Approve'),
      createEventViaSellerApi(request, sellerSession.access_token, 'Tier3 Bulk Reject'),
      createEventViaSellerApi(request, sellerSession.access_token, 'Tier3 Bulk PendingStill'),
    ]);

    for (const event of events) {
      await submitEventForReview(request, event.id, sellerSession.access_token);
    }

    await publishEventAsAdmin(request, events[0]!.id, 'published');
    await publishEventAsAdmin(request, events[1]!.id, 'rejected');

    const checks = await Promise.all(
      events.map((e) =>
        request.get(`${API_URL}/events/${e.slug}`, { headers: { Accept: 'application/json' } }),
      ),
    );

    expect(checks[0]!.ok(), 'Approved event must be publicly visible').toBeTruthy();
    expect(checks[1]!.ok(), 'Rejected event must NOT be publicly visible').toBe(false);
    expect(checks[2]!.ok(), 'Pending-review event must NOT be publicly visible').toBe(false);
    expect([403, 404]).toContain(checks[1]!.status());
    expect([403, 404]).toContain(checks[2]!.status());

    const adminSession = await withRetry(() => loginApi(request, ADMIN_EMAIL, ADMIN_PASSWORD));
    for (const event of events) {
      const adminDetail = await request.get(`${API_URL}/admin/events/${event.id}`, {
        headers: {
          Authorization: `Bearer ${adminSession.access_token}`,
          Accept: 'application/json',
        },
      });
      expect(adminDetail.ok()).toBeTruthy();
    }
  });
});
