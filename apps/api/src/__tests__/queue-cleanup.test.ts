import { schema } from '@jeevatix/core';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  enqueueReservationCleanup,
  reservationCleanupQueueHandler,
  type ReservationCleanupMessage,
} from '../queues/reservation-cleanup';
import { database, createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p10-queue-cleanup');
const { reservations } = schema;

function createQueueMock(send: ReturnType<typeof vi.fn>) {
  return {
    send,
    sendBatch: vi.fn(async () => undefined),
  } as unknown as Queue<ReservationCleanupMessage>;
}

describe.sequential('reservation cleanup queue', () => {
  beforeAll(async () => {
    await context.cleanupTestData();
  });

  afterEach(async () => {
    await context.cleanupTestData();
  });

  afterAll(async () => {
    await context.cleanupTestData();
  });

  it('enqueues cleanup work when a queue binding is available', async () => {
    const send = vi.fn(async () => undefined);

    const result = await enqueueReservationCleanup(
      {
        ...context.env(),
        RESERVATION_CLEANUP_QUEUE: createQueueMock(send),
      },
      1_775_560_000_000,
    );

    expect(result).toEqual({ enqueued: true });
    expect(send).toHaveBeenCalledWith({
      action: 'cleanup-expired-reservations',
      triggered_at: new Date(1_775_560_000_000).toISOString(),
    });
  });

  it('falls back to inline cleanup when the queue binding is missing', async () => {
    const result = await enqueueReservationCleanup(context.env());

    expect(result).toEqual({
      payment_reminders: 0,
      event_reminders: 0,
      processed: 0,
      skipped: 0,
    });
  });

  it('acks unrelated batches without running cleanup', async () => {
    const ackAll = vi.fn();

    await reservationCleanupQueueHandler(
      {
        messages: [{ body: { action: 'other-action' } as unknown as ReservationCleanupMessage }],
        ackAll,
      } as unknown as MessageBatch<ReservationCleanupMessage>,
      context.env(),
      {} as ExecutionContext,
    );

    expect(ackAll).toHaveBeenCalledOnce();
  });

  it('runs cleanup for queued messages and acknowledges the batch', async () => {
    const buyer = await context.createBuyerFixture();
    const seller = await context.createSellerFixture();
    const { tier } = await context.createEventFixture({ sellerProfileId: seller.sellerProfile.id });

    const reservationResponse = await context.requestJson('/reservations', {
      method: 'POST',
      token: buyer.token,
      body: {
        ticket_tier_id: tier.id,
        quantity: 1,
      },
    });
    const reservationPayload = await context.readJson<{
      data: { reservation_id: string };
    }>(reservationResponse);

    await database
      .update(reservations)
      .set({
        expiresAt: new Date(Date.now() - 60_000),
      })
      .where(eq(reservations.id, reservationPayload.data.reservation_id));

    const ackAll = vi.fn();

    await reservationCleanupQueueHandler(
      {
        messages: [{ body: { action: 'cleanup-expired-reservations' } }],
        ackAll,
      } as unknown as MessageBatch<ReservationCleanupMessage>,
      context.env(),
      {} as ExecutionContext,
    );

    const reservation = await context.getReservation(reservationPayload.data.reservation_id);

    expect(ackAll).toHaveBeenCalledOnce();
    expect(reservation?.status).toBe('expired');
  });
});
