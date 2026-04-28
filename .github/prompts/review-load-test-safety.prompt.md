---
description: "Review load-test, benchmark, synthetic traffic, or bulk load-test data changes for cost safety, cleanup, env scoping, and guardrail bypass risk before merge or execution."
agent: "reviewer"
argument-hint: "Describe the files, PR, or load-test change you want reviewed"
---
Review the selected or relevant load-test-related changes in Jeevatix with a cost-safety and production-safety mindset.

## Review Scope

Focus on files such as:

- `tests/load/**`
- `packages/core/scripts/**`
- `packages/core/src/db/seed-load-users.ts`
- `packages/core/src/db/cleanup-load-test-data.ts`
- `.github/**` if the change affects load-test policy, hooks, workflows, prompts, or instructions
- workflow or deployment files that could trigger traffic or validate load-test behavior

## What To Check

1. Remote execution safety
   - Does any change make remote load tests easier to run accidentally?
   - Is explicit user confirmation still required before remote execution?
   - Is production explicitly treated as stricter than staging?

2. Billing and blast radius
   - Does the change increase likely Cloudflare, database, queue, R2, email, or third-party usage?
   - Does the script make the scale obvious through env vars or explicit arguments?
   - Are there hidden bursts such as login floods, webhook floods, or repeated probes?

3. Environment scoping
   - Does the script clearly separate local vs staging vs production?
   - Is `BASE_URL` or equivalent target scoping explicit?
   - Are synthetic targets clearly named and isolated from real data?

4. Cleanup and reversibility
   - Is there a cleanup path for synthetic users, reservations, orders, payments, tickets, or benchmark events?
   - Are DB connections and other resources closed properly?
   - Could the change leave durable state or billable artifacts behind?

5. Guardrail bypass risk
   - Does the change bypass rate limits, auth protections, or anti-abuse safeguards?
   - Does it introduce loop-based traffic generation, parallel curl/wget probing, or hidden generators?
   - Does it weaken the new load-test instructions, hooks, or CI validator?

## Output Format

Use a strict review format with findings first.

### Findings

- Severity: high | medium | low
- File: path with line reference if available
- Risk: concise statement of the issue
- Why it matters: billing, production safety, cleanup, or correctness impact
- Recommended fix: concise actionable change

### Open Questions

- List only if needed.

### Summary

- Overall recommendation: APPROVE | REQUEST_CHANGES
- Residual risk if merged or executed as-is

Prioritize real blockers and production-risk findings over style comments.