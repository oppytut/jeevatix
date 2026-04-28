const chunks = [];

for await (const chunk of process.stdin) {
  chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
}

const inputText = Buffer.concat(chunks).toString('utf8');

const toolPatterns = [
  /run_in_terminal/i,
  /send_to_terminal/i,
  /create_and_run_task/i,
];

const loadTestPatterns = [
  /\bk6(\s+run)?\b/i,
  /\b(wrk|vegeta|autocannon|bombardier|jmeter|locust|hey)\b/i,
  /\bab\s+-[\w-]+/i,
  /\bpnpm\s+run\s+test:load(?::[\w:-]+)?\b/i,
  /run-load-scenario\.ts/i,
  /run-local-checkout-benchmark\.ts/i,
  /seed-load-users\.ts/i,
  /cleanup-load-test-data\.ts/i,
  /\btest:load(?::[\w:-]+)?\b/i,
];

const repeatedTrafficPatterns = [
  /for\s+\w+\s+in\s+.+\b(curl|wget)\b/is,
  /while\s+.+\b(curl|wget)\b/is,
  /\b(seq|jot)\b.+\|\s*(xargs|parallel).+\b(curl|wget)\b/is,
  /\bxargs\b.+\b(curl|wget)\b/is,
  /\bparallel\b.+\b(curl|wget)\b/is,
  /(?:\bcurl\b.*){3,}/is,
  /(?:\bwget\b.*){3,}/is,
];

const productionTargetPatterns = [
  /--stage\s+production/i,
  /\bSST_STAGE\s*=\s*production\b/i,
  /\bNODE_ENV\s*=\s*production\b/i,
  /\bAPP_ENV(?:IRONMENT)?\s*=\s*production\b/i,
  /\bPRODUCTION_(?:API|BUYER|ADMIN|SELLER)_DOMAIN\b/i,
  /https?:\/\/api\.jeevatix\.com\b/i,
  /https?:\/\/jeevatix\.com\b/i,
  /https?:\/\/admin\.jeevatix\.com\b/i,
  /https?:\/\/seller\.jeevatix\.com\b/i,
  /https?:\/\/[^\s]*production[^\s]*/i,
];

const looksLikeExecutableTool = toolPatterns.some((pattern) => pattern.test(inputText));
const looksLikeLoadTest =
  loadTestPatterns.some((pattern) => pattern.test(inputText)) ||
  repeatedTrafficPatterns.some((pattern) => pattern.test(inputText));

const isProductionTarget = productionTargetPatterns.some((pattern) => pattern.test(inputText));

if (!looksLikeExecutableTool || !looksLikeLoadTest) {
  process.exit(0);
}

const output = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'ask',
    permissionDecisionReason: isProductionTarget
      ? 'Production-targeted load-test or high-volume traffic command detected. Explicit reconfirmation is required.'
      : 'Known load-test or high-volume traffic command detected. Explicit user confirmation is required.',
  },
  systemMessage: isProductionTarget
    ? 'This command appears to target production with a load test, benchmark, or other high-volume traffic operation. Do not run it until the user explicitly reconfirms in the current conversation. Before asking, summarize the target environment, planned scale, services that may incur billing, possible side effects, and cleanup plan.'
    : 'This command appears to run a load test, benchmark, repeated high-volume traffic operation, or bulk load-test data action. Ask the user for explicit confirmation in the current conversation before running it, and summarize the target environment, planned scale, services that may incur billing, possible side effects, and cleanup plan.',
};

process.stdout.write(`${JSON.stringify(output)}\n`);