---
description: "Use when writing, modifying, reviewing, or preparing to run load tests, K6 scenarios, performance benchmarks, stress tests, synthetic traffic scripts, or bulk seed/cleanup scripts related to load testing. Covers cost safety, startup-budget constraints, and mandatory user confirmation before execution."
applyTo:
  - "tests/load/**"
  - "packages/core/scripts/**"
  - "packages/core/src/db/seed-load-users.ts"
  - "packages/core/src/db/cleanup-load-test-data.ts"
---
# Load Testing Safety

- Treat all load-testing work as cost-sensitive because remote environments run on usage-billed Cloudflare services and a startup budget.
- Never execute load tests, synthetic traffic, repeated high-volume probes, or bulk seed/cleanup scripts without explicit user confirmation in the current conversation.
- Before asking for confirmation, summarize the target environment, expected scale, likely billed services, side effects, and cleanup plan.
- Prefer local runs, the smallest meaningful scale, and read-only analysis before proposing remote execution.
- If a test plan would bypass rate limits, auth protections, provider safeguards, or use repeated `curl`/`wget` loops or `xargs`/`parallel` traffic generation, call that out explicitly and require user approval before implementing or running it.
- Production-targeted load testing always requires explicit reconfirmation in the current conversation, even if staging testing was previously approved.
- When editing these files, preserve or improve throttling, env scoping, cleanup steps, and cost-visible naming so the blast radius stays obvious.