import http from 'k6/http';
import crypto from 'k6/crypto';
import { check, sleep, group } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';
const TARGET_TIER = __ENV.TARGET_TIER || '';
const TOTAL_USERS = parseInt(__ENV.TOTAL_USERS || '500', 10);
const USER_PREFIX = __ENV.CHECKOUT_LOAD_TEST_PREFIX || 'checkout';
const PASSWORD = __ENV.LOAD_TEST_PASSWORD || 'LoadTest123!';
const LOGIN_BATCH_SIZE = parseInt(__ENV.LOGIN_BATCH_SIZE || '100', 10);
const PAYMENT_METHOD = __ENV.PAYMENT_METHOD || 'bank_transfer';
const PAYMENT_WEBHOOK_SECRET = __ENV.PAYMENT_WEBHOOK_SECRET || 'local-load-test-webhook-secret';
const RESERVATION_CONNECTION_CLOSE = __ENV.RESERVATION_CONNECTION_CLOSE === '1';
const LOAD_TEST_CLIENT_START_HEADER = 'x-load-test-client-start-ms';

const flowSuccess = new Counter('checkout_flow_success');
const flowFailed = new Counter('checkout_flow_failed');
const reservationSoldOut = new Counter('checkout_flow_reservation_sold_out');
const reservationStep = new Trend('step_reservation_duration', true);
const reservationHttpDuration = new Trend('reservation_http_duration', true);
const reservationHttpBlocked = new Trend('reservation_http_blocked', true);
const reservationHttpConnecting = new Trend('reservation_http_connecting', true);
const reservationHttpWaiting = new Trend('reservation_http_waiting', true);
const reservationClientOverhead = new Trend('reservation_client_overhead', true);
const orderStep = new Trend('step_order_duration', true);
const orderHttpDuration = new Trend('order_http_duration', true);
const orderHttpBlocked = new Trend('order_http_blocked', true);
const orderHttpConnecting = new Trend('order_http_connecting', true);
const orderHttpWaiting = new Trend('order_http_waiting', true);
const orderClientOverhead = new Trend('order_client_overhead', true);
const paymentStep = new Trend('step_payment_duration', true);
const webhookStep = new Trend('step_webhook_duration', true);
const fullFlowDuration = new Trend('full_flow_duration', true);

function signWebhookPayload(payload) {
  return crypto.hmac('sha256', PAYMENT_WEBHOOK_SECRET, payload, 'hex');
}

export const options = {
  vus: TOTAL_USERS,
  iterations: TOTAL_USERS,
  setupTimeout: '5m',
  thresholds: {
    checkout_flow_success: [`count==${TOTAL_USERS}`],
    checkout_flow_failed: ['count==0'],
    checkout_flow_reservation_sold_out: ['count==0'],
    full_flow_duration: ['p(95)<3000'],
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.5'],
  },
};

const users = new SharedArray('users', function () {
  const arr = [];

  for (let i = 0; i < TOTAL_USERS; i++) {
    arr.push({
      email: `${USER_PREFIX}+${i}@jeevatix.com`,
      password: PASSWORD,
    });
  }

  return arr;
});

export function setup() {
  if (!TARGET_TIER) {
    throw new Error('TARGET_TIER env is required.');
  }

  const tokens = [];

  console.log(`[setup] Logging in ${TOTAL_USERS} pre-seeded checkout users...`);

  for (let i = 0; i < TOTAL_USERS; i += LOGIN_BATCH_SIZE) {
    const end = Math.min(i + LOGIN_BATCH_SIZE, TOTAL_USERS);
    const requests = [];

    for (let index = i; index < end; index += 1) {
      const user = users[index];

      requests.push({
        method: 'POST',
        url: `${BASE_URL}/auth/login`,
        body: JSON.stringify({
          email: user.email,
          password: user.password,
        }),
        params: {
          headers: { 'Content-Type': 'application/json' },
          responseCallback: http.expectedStatuses(200),
        },
      });
    }

    const responses = http.batch(requests);

    for (let index = 0; index < responses.length; index += 1) {
      const loginRes = responses[index];

      if (loginRes.status === 200) {
        try {
          const body = JSON.parse(loginRes.body);
          if (body.success && body.data && body.data.access_token) {
            tokens.push(body.data.access_token);
          }
        } catch {
          console.warn(`[setup] Failed to parse login for user ${i + index}`);
        }
      } else {
        console.warn(`[setup] Login failed for user ${i + index}: ${loginRes.status}`);
      }
    }
  }

  if (tokens.length === 0) {
    throw new Error('No access tokens were created. Run pnpm run seed:load-users first.');
  }

  console.log(`[setup] Got ${tokens.length} tokens`);

  return { tokens, targetTier: TARGET_TIER };
}

export default function (data) {
  const vuIndex = __VU - 1;
  const token = data.tokens[vuIndex % data.tokens.length];

  if (!token) {
    console.warn(`[VU ${__VU}] No token available, skipping`);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const flowStart = Date.now();
  let reservationId = null;
  let orderId = null;
  let externalRef = null;
  let reservationStatus = null;
  let reservationBody = null;

  group('Step 1 — Reserve Ticket', function () {
    const start = Date.now();
    const reservationHeaders = RESERVATION_CONNECTION_CLOSE
      ? {
          ...headers,
          Connection: 'close',
          [LOAD_TEST_CLIENT_START_HEADER]: String(start),
        }
      : {
          ...headers,
          [LOAD_TEST_CLIENT_START_HEADER]: String(start),
        };
    const res = http.post(
      `${BASE_URL}/reservations`,
      JSON.stringify({
        ticket_tier_id: data.targetTier,
        quantity: 1,
      }),
      {
        headers: reservationHeaders,
        responseCallback: http.expectedStatuses(201),
      },
    );
    const reservationElapsed = Date.now() - start;
    reservationStep.add(reservationElapsed);
    reservationHttpDuration.add(res.timings.duration);
    reservationHttpBlocked.add(res.timings.blocked);
    reservationHttpConnecting.add(res.timings.connecting);
    reservationHttpWaiting.add(res.timings.waiting);
    reservationClientOverhead.add(Math.max(0, reservationElapsed - res.timings.duration));
    reservationStatus = res.status;
    reservationBody = res.body;

    const reservationOk = check(res, {
      'reservation: status 201': (response) => response.status === 201,
    });

    if (res.status === 201) {
      try {
        const body = JSON.parse(res.body);
        if (body.success && body.data) {
          reservationId = body.data.reservation_id;
        }
      } catch {
        reservationId = null;
      }
    }

    if (res.status === 409) {
      reservationSoldOut.add(1);
      flowFailed.add(1);
      if (__VU <= 5) {
        console.warn(`[VU ${__VU}] Reservation sold out: ${res.status} - ${res.body}`);
      }
    } else if (!reservationOk || !reservationId) {
      flowFailed.add(1);
      if (__VU <= 5) {
        console.warn(`[VU ${__VU}] Reservation failed: ${res.status} - ${res.body}`);
      }
    }
  });

  if (!reservationId) {
    if (__VU <= 5 && reservationStatus && reservationStatus !== 409) {
      console.warn(`[VU ${__VU}] Aborting flow after reservation step: ${reservationStatus} - ${reservationBody}`);
    }
    sleep(0.5);
    return;
  }

  group('Step 2 — Create Order', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({
        reservation_id: reservationId,
      }),
      {
        headers,
        responseCallback: http.expectedStatuses(201),
      },
    );
    const orderElapsed = Date.now() - start;
    orderStep.add(orderElapsed);
    orderHttpDuration.add(res.timings.duration);
    orderHttpBlocked.add(res.timings.blocked);
    orderHttpConnecting.add(res.timings.connecting);
    orderHttpWaiting.add(res.timings.waiting);
    orderClientOverhead.add(Math.max(0, orderElapsed - res.timings.duration));

    const orderOk = check(res, {
      'order: status 201': (response) => response.status === 201,
    });

    if (orderOk && res.status === 201) {
      try {
        const body = JSON.parse(res.body);
        if (body.success && body.data) {
          orderId = body.data.id;
        }
      } catch {
        orderId = null;
      }
    }

    if (!orderOk || !orderId) {
      flowFailed.add(1);
      console.warn(`[VU ${__VU}] Order failed: ${res.status} - ${res.body}`);
    }
  });

  if (!orderId) {
    sleep(0.5);
    return;
  }

  group('Step 3 — Pay', function () {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/payments/${orderId}/pay`,
      JSON.stringify({
        method: PAYMENT_METHOD,
      }),
      {
        headers,
        responseCallback: http.expectedStatuses(200),
      },
    );
    paymentStep.add(Date.now() - start);

    const payOk = check(res, {
      'payment: status 200': (response) => response.status === 200,
    });

    if (payOk && res.status === 200) {
      try {
        const body = JSON.parse(res.body);
        if (body.success && body.data) {
          externalRef = body.data.external_ref;
        }
      } catch {
        externalRef = null;
      }
    }

    if (!payOk || !externalRef) {
      flowFailed.add(1);
      if (__VU <= 5) {
        console.warn(`[VU ${__VU}] Payment failed: ${res.status} - ${res.body}`);
      }
    }
  });

  if (!externalRef) {
    sleep(0.5);
    return;
  }

  group('Step 4 — Confirm Payment Webhook', function () {
    const paidAt = new Date().toISOString();
    const payload = JSON.stringify({
      external_ref: externalRef,
      status: 'success',
      paid_at: paidAt,
    });
    const start = Date.now();
    const res = http.post(`${BASE_URL}/webhooks/payment`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-payment-signature': signWebhookPayload(payload),
      },
      responseCallback: http.expectedStatuses(200),
    });
    webhookStep.add(Date.now() - start);

    const webhookOk = check(res, {
      'webhook: status 200': (response) => response.status === 200,
    });

    if (webhookOk) {
      flowSuccess.add(1);
      fullFlowDuration.add(Date.now() - flowStart);
    } else {
      flowFailed.add(1);
      if (__VU <= 5) {
        console.warn(`[VU ${__VU}] Webhook failed: ${res.status} - ${res.body}`);
      }
    }
  });
  sleep(0.5);
}

export function teardown(data) {
  console.log('='.repeat(60));
  console.log('CHECKOUT FLOW LOAD TEST — RESULTS');
  console.log('='.repeat(60));
  console.log(`Target Tier: ${data.targetTier}`);
  console.log(`Total users with tokens: ${data.tokens.length}`);
  console.log('');
  console.log('Check the K6 summary above for:');
  console.log('  - full_flow_duration p(95) should be < 3000ms');
  console.log('  - checkout_flow_success count');
  console.log('  - checkout_flow_failed count');
  console.log('  - checkout_flow_reservation_sold_out count');
  console.log('  - step_webhook_duration for payment confirmation');
  console.log('  - automated DB validation from the root load-test runner');
  console.log('='.repeat(60));
}
