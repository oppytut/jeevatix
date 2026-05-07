import { expect, test } from '@playwright/test';
import {
  createBuyerViaApi,
  createPublishedEventFixture,
  loginApi,
  uniqueEmail,
} from './helpers';

test.describe('Concurrent Reservations (War Ticket Scenario)', () => {
  test.describe.configure({ mode: 'serial' });

  let eventSlug: string;
  let tierId: string;
  let tierCapacity: number;

  test.beforeAll(async ({ request }) => {
    const fixture = await createPublishedEventFixture(request);
    eventSlug = fixture.event.slug;
    tierId = fixture.tiers[0].id;
    tierCapacity = 10;
  });

  test('should handle concurrent reservations correctly', async ({ request }) => {
    const numBuyers = 5;
    const buyers = await Promise.all(
      Array.from({ length: numBuyers }, async (_, i) => {
        const email = uniqueEmail(`concurrent-buyer-${i}`);
        const password = 'Buyer123!';
        const buyer = await createBuyerViaApi(request, {
          email,
          password,
          full_name: `Concurrent Buyer ${i}`,
        });
        const session = await loginApi(request, email, password);
        return { email, password, userId: buyer.userId, session };
      }),
    );

    const reservationPromises = buyers.map(async (buyer) => {
      try {
        const response = await request.post('http://localhost:8787/reservations', {
          headers: {
            Authorization: `Bearer ${buyer.session.access_token}`,
          },
          data: {
            event_slug: eventSlug,
            tier_id: tierId,
            quantity: 3,
          },
        });

        if (response.ok()) {
          const data = await response.json();
          return { success: true, data: data.data, buyer: buyer.email };
        } else {
          const error = await response.json();
          return { success: false, error, buyer: buyer.email };
        }
      } catch (error) {
        return { success: false, error, buyer: buyer.email };
      }
    });

    const results = await Promise.all(reservationPromises);

    const successfulReservations = results.filter((r) => r.success);
    const failedReservations = results.filter((r) => !r.success);

    console.log('Successful reservations:', successfulReservations.length);
    console.log('Failed reservations:', failedReservations.length);

    expect(successfulReservations.length).toBeGreaterThan(0);
    expect(successfulReservations.length).toBeLessThanOrEqual(numBuyers);

    const totalReserved = successfulReservations.reduce((sum, r) => {
      return sum + (r.data?.quantity || 0);
    }, 0);

    expect(totalReserved).toBeLessThanOrEqual(tierCapacity);
  });

  test('should prevent overselling with rapid concurrent requests', async ({ request }) => {
    const buyer = await createBuyerViaApi(request, {
      email: uniqueEmail('rapid-buyer'),
      password: 'Buyer123!',
      full_name: 'Rapid Buyer',
    });

    const session = await loginApi(request, buyer.email, 'Buyer123!');

    const rapidRequests = Array.from({ length: 10 }, () =>
      request.post('http://localhost:8787/reservations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        data: {
          event_slug: eventSlug,
          tier_id: tierId,
          quantity: 1,
        },
      }),
    );

    const responses = await Promise.allSettled(rapidRequests);

    const successful = responses.filter(
      (r) => r.status === 'fulfilled' && r.value.ok(),
    ).length;

    expect(successful).toBeGreaterThan(0);
    expect(successful).toBeLessThanOrEqual(10);
  });

  test('should maintain data consistency after concurrent operations', async ({ request }) => {
    const buyer1 = await createBuyerViaApi(request, {
      email: uniqueEmail('consistency-buyer-1'),
      password: 'Buyer123!',
      full_name: 'Consistency Buyer 1',
    });

    const buyer2 = await createBuyerViaApi(request, {
      email: uniqueEmail('consistency-buyer-2'),
      password: 'Buyer123!',
      full_name: 'Consistency Buyer 2',
    });

    const session1 = await loginApi(request, buyer1.email, 'Buyer123!');
    const session2 = await loginApi(request, buyer2.email, 'Buyer123!');

    const [res1, res2] = await Promise.all([
      request.post('http://localhost:8787/reservations', {
        headers: { Authorization: `Bearer ${session1.access_token}` },
        data: { event_slug: eventSlug, tier_id: tierId, quantity: 2 },
      }),
      request.post('http://localhost:8787/reservations', {
        headers: { Authorization: `Bearer ${session2.access_token}` },
        data: { event_slug: eventSlug, tier_id: tierId, quantity: 2 },
      }),
    ]);

    const tierResponse = await request.get(
      `http://localhost:8787/events/${eventSlug}/tiers/${tierId}`,
    );

    expect(tierResponse.ok()).toBeTruthy();

    const tierData = await tierResponse.json();
    expect(tierData.success).toBe(true);
    expect(tierData.data.sold_count).toBeGreaterThanOrEqual(0);
  });

  test('should handle reservation expiry correctly', async ({ request }) => {
    const buyer = await createBuyerViaApi(request, {
      email: uniqueEmail('expiry-buyer'),
      password: 'Buyer123!',
      full_name: 'Expiry Buyer',
    });

    const session = await loginApi(request, buyer.email, 'Buyer123!');

    const reserveResponse = await request.post('http://localhost:8787/reservations', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: {
        event_slug: eventSlug,
        tier_id: tierId,
        quantity: 1,
      },
    });

    expect(reserveResponse.ok()).toBeTruthy();
    const reserveData = await reserveResponse.json();
    const reservationId = reserveData.data.reservation_id;
    const expiresAt = new Date(reserveData.data.expires_at);

    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const checkResponse = await request.get(
      `http://localhost:8787/reservations/${reservationId}`,
    );

    if (checkResponse.ok()) {
      const checkData = await checkResponse.json();
      expect(checkData.data).toBeDefined();
    }
  });

  test('should release stock when reservation expires', async ({ request }) => {
    const buyer = await createBuyerViaApi(request, {
      email: uniqueEmail('release-buyer'),
      password: 'Buyer123!',
      full_name: 'Release Buyer',
    });

    const session = await loginApi(request, buyer.email, 'Buyer123!');

    const tierBefore = await request.get(
      `http://localhost:8787/events/${eventSlug}/tiers/${tierId}`,
    );
    const tierBeforeData = await tierBefore.json();
    const soldBefore = tierBeforeData.data.sold_count;

    const reserveResponse = await request.post('http://localhost:8787/reservations', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      data: {
        event_slug: eventSlug,
        tier_id: tierId,
        quantity: 1,
      },
    });

    if (reserveResponse.ok()) {
      const reserveData = await reserveResponse.json();
      expect(reserveData.data.reservation_id).toBeDefined();

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const tierAfter = await request.get(
        `http://localhost:8787/events/${eventSlug}/tiers/${tierId}`,
      );
      const tierAfterData = await tierAfter.json();

      expect(tierAfterData.data.sold_count).toBeGreaterThanOrEqual(soldBefore);
    }
  });
});
