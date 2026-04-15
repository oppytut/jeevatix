export type TimedStep = {
  step: string;
  durationMs: number;
};

export type LoadTestProfile = {
  enabled: boolean;
  requestSequence?: number;
};

type HeadersLike = {
  get(name: string): string | null | undefined;
};

export const LOAD_TEST_PROFILE_HEADER = 'x-load-test-profile';
export const LOAD_TEST_PROFILE_SEQUENCE_HEADER = 'x-load-test-profile-request-sequence';
export const LOAD_TEST_CLIENT_START_HEADER = 'x-load-test-client-start-ms';

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

export function shouldProfileLoadTests() {
  return getProcessEnv('LOAD_TEST_PROFILE') === '1';
}

export function isReservationRequest(requestUrl: string) {
  return new URL(requestUrl).pathname.startsWith('/reservations');
}

function parseRequestSequence(rawValue: string | null | undefined) {
  const parsedValue = Number.parseInt(rawValue ?? '', 10);

  if (Number.isFinite(parsedValue) && parsedValue > 0) {
    return parsedValue;
  }

  return undefined;
}

function getHeaderProfile(headers?: HeadersLike | null): LoadTestProfile {
  return {
    enabled: headers?.get(LOAD_TEST_PROFILE_HEADER) === '1',
    requestSequence: parseRequestSequence(headers?.get(LOAD_TEST_PROFILE_SEQUENCE_HEADER)),
  };
}

export function getReservationLoadTestProfile(
  requestUrl: string,
  headers?: HeadersLike | null,
): LoadTestProfile {
  if (!isReservationRequest(requestUrl)) {
    return { enabled: false };
  }

  const headerProfile = getHeaderProfile(headers);

  if (shouldProfileLoadTests()) {
    return {
      enabled: true,
      requestSequence: headerProfile.requestSequence,
    };
  }

  return headerProfile;
}

export function logTimedSteps(
  profile: LoadTestProfile | undefined,
  scope: string,
  details: Record<string, unknown>,
  steps: TimedStep[],
) {
  if (!profile?.enabled && !shouldProfileLoadTests()) {
    return;
  }

  console.log(
    `[load-profile] ${scope}`,
    JSON.stringify({
      ...details,
      ...(profile?.requestSequence ? { requestSequence: profile.requestSequence } : {}),
      steps,
    }),
  );
}
