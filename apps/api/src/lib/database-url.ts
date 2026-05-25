type DatabaseEnv = {
  DATABASE_URL?: string;
  Hyperdrive?: Hyperdrive;
  DISABLE_HYPERDRIVE?: string;
};

function getProcessEnv(key: string) {
  return (
    globalThis as typeof globalThis & {
      process?: {
        env?: Record<string, string | undefined>;
      };
    }
  ).process?.env?.[key];
}

function isHyperdriveDisabled(env?: DatabaseEnv) {
  return env?.DISABLE_HYPERDRIVE === '1' || getProcessEnv('DISABLE_HYPERDRIVE') === '1';
}

export function resolveDatabaseUrl(env?: DatabaseEnv): string | undefined {
  const hyperdriveUrl = isHyperdriveDisabled(env) ? undefined : env?.Hyperdrive?.connectionString;

  return hyperdriveUrl ?? env?.DATABASE_URL ?? getProcessEnv('DATABASE_URL');
}
