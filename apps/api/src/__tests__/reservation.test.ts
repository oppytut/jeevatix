import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p6-reservation');

describe.sequential('Phase 6 Reservation API', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('creates a reservation and returns its active state', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { event, tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 5,
    });

    const createResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 2,
      },
    });

    const createPayload = await context.readJson<{
      success: boolean;
      data: { reservation_id: string; expires_at: string };
    }>(createResponse);

    expect(createResponse.status).toBe(201);
    expect(createPayload.success).toBe(true);
    expect(createPayload.data.reservation_id).toBeTruthy();
    expect(new Date(createPayload.data.expires_at).getTime()).toBeGreaterThan(Date.now());

    const reservationResponse = await context.requestJson(
      `/reservations/${createPayload.data.reservation_id}`,
      {
        token: buyer.token,
      },
    );

    const reservationPayload = await context.readJson<{
      success: boolean;
      data: {
        id: string;
        status: string;
        quantity: number;
        event_title: string;
        remaining_seconds: number;
      };
    }>(reservationResponse);

    const tierRecord = await context.getTicketTier(tier.id);

    expect(reservationResponse.status).toBe(200);
    expect(reservationPayload.success).toBe(true);
    expect(reservationPayload.data.id).toBe(createPayload.data.reservation_id);
    expect(reservationPayload.data.status).toBe('active');
    expect(reservationPayload.data.quantity).toBe(2);
    expect(reservationPayload.data.event_title).toBe(event.title);
    expect(reservationPayload.data.remaining_seconds).toBeGreaterThan(0);
    expect(tierRecord?.soldCount).toBe(2);
  });

  it('rejects reservation when requested quantity exceeds remaining stock', async () => {
    const firstBuyer = await context.createBuyerFixture();
    const secondBuyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 2,
    });

    const firstReservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: firstBuyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 2,
      },
    });

    const soldOutResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: secondBuyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });

    const soldOutPayload = await context.readJson<{
      success: boolean;
      error: { code: string; message: string };
    }>(soldOutResponse);

    expect(firstReservationResponse.status).toBe(201);
    expect(soldOutResponse.status).toBe(409);
    expect(soldOutPayload.success).toBe(false);
    expect(soldOutPayload.error.code).toBe('SOLD_OUT');
  });

  it('cancels an active reservation and restores sold count', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      quota: 4,
    });

    const createResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 3,
      },
    });

    const createPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(createResponse);

    const cancelResponse = await context.requestJson(
      `/reservations/${createPayload.data.reservation_id}`,
      {
        method: 'DELETE',
        token: buyer.token,
      },
    );

    const cancelPayload = await context.readJson<{
      success: boolean;
      data: { reservation_id: string; status: string };
    }>(cancelResponse);

    const tierRecord = await context.getTicketTier(tier.id);
    const reservationRecord = await context.getReservation(createPayload.data.reservation_id);

    expect(cancelResponse.status).toBe(200);
    expect(cancelPayload.success).toBe(true);
    expect(cancelPayload.data.reservation_id).toBe(createPayload.data.reservation_id);
    expect(cancelPayload.data.status).toBe('cancelled');
    expect(tierRecord?.soldCount).toBe(0);
    expect(reservationRecord?.status).toBe('cancelled');
  });

  it('rejects reservation creation without authentication', async () => {
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
    });

    const response = await context.requestJson('/reservations', {
      method: 'POST',
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });

    const payload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(response);

    expect(response.status).toBe(401);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects a second active reservation for the same event even when another event is also reserved', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const firstEvent = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
    });
    const secondEvent = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
    });

    const firstReservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: firstEvent.tier.id,
        quantity: 1,
      },
    });

    const secondReservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: secondEvent.tier.id,
        quantity: 1,
      },
    });

    const duplicateReservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: firstEvent.tier.id,
        quantity: 1,
      },
    });
    const duplicateReservationPayload = await context.readJson<{
      success: boolean;
      error: { code: string };
    }>(duplicateReservationResponse);

    expect(firstReservationResponse.status).toBe(201);
    expect(secondReservationResponse.status).toBe(201);
    expect(duplicateReservationResponse.status).toBe(409);
    expect(duplicateReservationPayload.success).toBe(false);
    expect(duplicateReservationPayload.error.code).toBe('ACTIVE_RESERVATION_EXISTS');
  });

  it('rejects reservations outside the active sale window', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({
      sellerProfileId: seller.sellerProfile.id,
      saleStartAt: new Date('2035-01-01T00:00:00.000Z'),
      saleEndAt: new Date('2035-01-02T00:00:00.000Z'),
    });

    const response = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const payload = await context.readJson<{
      success: boolean;
      error: { code: string; message: string };
    }>(response);

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.error.code).toBe('INVALID_STATE');
    expect(payload.error.message).toContain('sale window');
  });
});
