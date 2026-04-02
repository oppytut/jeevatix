import { describe, expect, it, vi } from 'vitest';

import worker from '../index';
import type { ReservationCleanupMessage } from '../queues/reservation-cleanup';
import { createTransactionTestContext } from './transaction-test-helpers';

const context = createTransactionTestContext('vitest-p10-index-worker');

describe('api worker wrappers', () => {
  it('forwards queue batches to the reservation cleanup handler', async () => {
    const ackAll = vi.fn();

    await worker.queue?.(
      {
        messages: [{ body: { action: 'other-action' } as ReservationCleanupMessage }],
        ackAll,
      } as unknown as MessageBatch<ReservationCleanupMessage>,
      context.env(),
      {} as ExecutionContext,
    );

    expect(ackAll).toHaveBeenCalledOnce();
  });

  it('enqueues scheduled cleanup work through waitUntil', async () => {
    const send = vi.fn(async () => undefined);
    const waitUntil = vi.fn(async (promise: Promise<unknown>) => promise);

    await worker.scheduled?.(
      {
        scheduledTime: 1_775_560_000_000,
      } as ScheduledController,
      {
        ...context.env(),
        RESERVATION_CLEANUP_QUEUE: { send } as Queue<ReservationCleanupMessage>,
      },
      {
        waitUntil,
      } as unknown as ExecutionContext,
    );

    expect(waitUntil).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith({
      action: 'cleanup-expired-reservations',
      triggered_at: new Date(1_775_560_000_000).toISOString(),
    });
  });
});