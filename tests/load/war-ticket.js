import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';
const TARGET_TIER = __ENV.TARGET_TIER || '';
const TARGET_EVENT_SLUG = __ENV.TARGET_EVENT_SLUG || '';
const TOTAL_USERS = parseInt(__ENV.TOTAL_USERS || '1000', 10);
const USER_PREFIX = __ENV.LOAD_TEST_PREFIX || 'loadtest';
const PASSWORD = __ENV.LOAD_TEST_PASSWORD || 'LoadTest123!';
const LOGIN_BATCH_SIZE = parseInt(__ENV.LOGIN_BATCH_SIZE || '100', 10);
const MAX_DURATION = __ENV.MAX_DURATION || '2m';
const reservationResponseCallback = http.expectedStatuses(201, 409);

const reservationSuccess = new Counter('reservation_success');
const reservationSoldOut = new Counter('reservation_sold_out');
const reservationError = new Counter('reservation_error');
const reservationDuration = new Trend('reservation_duration', true);

export const options = {
  scenarios: {
    reserve_once: {
      executor: 'per-vu-iterations',
      vus: TOTAL_USERS,
      iterations: 1,
      maxDuration: MAX_DURATION,
    },
  },
  setupTimeout: '5m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.3'],
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

  console.log(`[setup] Logging in ${TOTAL_USERS} pre-seeded test users...`);

  for (let i = 0; i < TOTAL_USERS; i += LOGIN_BATCH_SIZE) {
    const end = Math.min(i + LOGIN_BATCH_SIZE, TOTAL_USERS);
    const requests = [];

    for (let j = i; j < end; j++) {
      const user = users[j];

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

    for (let index = 0; index < responses.length; index++) {
      const loginRes = responses[index];

      if (loginRes.status === 200) {
        try {
          const body = JSON.parse(loginRes.body);
          if (body.success && body.data && body.data.access_token) {
            tokens.push(body.data.access_token);
          }
        } catch {
          console.warn(`[setup] Failed to parse login response for user ${i + index}`);
        }
      } else {
        console.warn(`[setup] Login failed for user ${i + index}: ${loginRes.status}`);
      }
    }
  }

  if (tokens.length === 0) {
    throw new Error('No access tokens were created. Run pnpm run seed:load-users first.');
  }

  console.log(`[setup] Successfully logged in ${tokens.length} users`);

  return { tokens, targetTier: TARGET_TIER, targetEventSlug: TARGET_EVENT_SLUG };
}

export default function (data) {
  const vuIndex = __VU - 1;
  const token = data.tokens[vuIndex % data.tokens.length];

  if (!token) {
    console.warn(`[VU ${__VU}] No token available, skipping`);
    return;
  }

  const startTime = Date.now();
  const res = http.post(
    `${BASE_URL}/reservations`,
    JSON.stringify({
      ticket_tier_id: data.targetTier,
      quantity: 1,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      responseCallback: reservationResponseCallback,
    },
  );

  reservationDuration.add(Date.now() - startTime);

  check(res, {
    'status is 201 or 409': (response) => [201, 409].includes(response.status),
  });

  if (res.status === 201) {
    reservationSuccess.add(1);
  } else if (res.status === 409) {
    reservationSoldOut.add(1);
  } else {
    reservationError.add(1);
    if (__VU <= 5) {
      console.warn(`[VU ${__VU}] Unexpected status: ${res.status} - ${res.body}`);
    }
  }

  sleep(0);
}

export function teardown(data) {
  console.log('='.repeat(60));
  console.log('WAR TICKET LOAD TEST — TEARDOWN VERIFICATION');
  console.log('='.repeat(60));

  const healthRes = http.get(`${BASE_URL}/health`, {
    responseCallback: http.expectedStatuses(200),
  });

  if (healthRes.status === 200) {
    console.log('[teardown] API is healthy');
  }

  if (data.targetEventSlug) {
    const eventRes = http.get(`${BASE_URL}/events/${data.targetEventSlug}`, {
      responseCallback: http.expectedStatuses(200),
    });

    check(eventRes, {
      'event detail available for teardown': (response) => response.status === 200,
    });

    if (eventRes.status === 200) {
      const body = JSON.parse(eventRes.body);
      const targetTier = body?.data?.tiers?.find((tier) => tier.id === data.targetTier);

      if (!targetTier) {
        throw new Error(
          `Target tier ${data.targetTier} was not found in event ${data.targetEventSlug}.`,
        );
      }

      console.log(`[teardown] Tier quota: ${targetTier.quota}`);
      console.log(`[teardown] Tier sold_count: ${targetTier.sold_count}`);
      console.log(`[teardown] Tier remaining: ${targetTier.remaining}`);

      if (targetTier.sold_count > targetTier.quota) {
        throw new Error(
          `Overselling detected: sold_count=${targetTier.sold_count}, quota=${targetTier.quota}`,
        );
      }
    }
  }

  console.log(`[teardown] Target Tier: ${data.targetTier}`);
  console.log('[teardown] Root script now runs automated DB validation after k6 exits.');
  console.log('='.repeat(60));
}
