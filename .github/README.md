# AI Development Setup

This directory contains AI-assisted development configuration for Jeevatix.

## Directory Structure

- **copilot-instructions.md** — Workspace-wide rules (always active)
- **instructions/** — Auto-attach instruction files for specific code patterns
- **prompts/** — Reusable AI prompt templates (slash commands)
- **agents/** — Custom code review agents
- **hooks/** — Load test approval guards
- **scripts/** — Utility scripts
- **workflows/** — CI/CD automation

---

## Quick Reference

### Instructions (Auto-Attach)

These files automatically provide context when working on specific code areas:

| Code Pattern | Instruction File | When It Applies |
|---|---|---|
| API route handler | `instructions/api-routes.instructions.md` | Creating/editing Hono route handlers |
| Service layer logic | `instructions/api-services.instructions.md` | Business logic, DB queries, orchestration |
| Zod + OpenAPI schema | `instructions/api-schemas.instructions.md` | Request/response validation schemas |
| Drizzle ORM schema | `instructions/drizzle-schema.instructions.md` | Database schema definitions |
| SvelteKit page | `instructions/svelte-pages.instructions.md` | Frontend pages and components |
| Load test safety | `instructions/load-testing.instructions.md` | Before running load tests |
| Session handoff | `instructions/handoff-maintenance.instructions.md` | Creating handoff documents |

### Prompts (Slash Commands)

Reusable templates for common tasks:

| Command | File | Purpose |
|---|---|---|
| `/load-test-preflight` | `prompts/load-test-preflight.prompt.md` | Load test approval request |
| `/review-load-test-safety` | `prompts/review-load-test-safety.prompt.md` | Safety review checklist |
| `/new-api-endpoint` | `prompts/new-api-endpoint.prompt.md` | Generate 3-file endpoint (route + service + schema) |
| `/new-svelte-page` | `prompts/new-svelte-page.prompt.md` | Generate SvelteKit page |
| `/phase-checkpoint` | `prompts/phase-checkpoint.prompt.md` | Phase validation |
| `/resume-session` | `prompts/resume-session.prompt.md` | Resume session context |

### Agents

| Agent | File | Purpose |
|---|---|---|
| Reviewer | `agents/reviewer.agent.md` | Read-only code review agent |

---

## How It Works

### Instructions

Instructions are **automatically attached** when you work on relevant code:

1. AI detects you're editing a file in `apps/api/src/routes/`
2. Automatically loads `api-routes.instructions.md`
3. Follows the patterns defined in that file

**You don't need to manually invoke instructions** — they're context-aware.

### Prompts

Prompts are **manually invoked** using slash commands:

```
/new-api-endpoint
```

The AI will follow the template in `prompts/new-api-endpoint.prompt.md` to generate a complete endpoint (route + service + schema).

### Agents

Agents are **specialized AI assistants** for specific tasks:

```
@reviewer review this PR
```

The reviewer agent will analyze code changes and provide feedback.

---

## Key Conventions

### API Architecture (3-Layer Pattern)

All API code follows a strict separation:

1. **Route** (`apps/api/src/routes/`) — Thin HTTP handlers, OpenAPI contract
2. **Service** (`apps/api/src/services/`) — Business logic, DB queries, no HTTP context
3. **Schema** (`apps/api/src/schemas/`) — Zod + OpenAPI validation

**See detailed patterns in:**
- `instructions/api-routes.instructions.md`
- `instructions/api-services.instructions.md`
- `instructions/api-schemas.instructions.md`

### Load Test Safety

⚠️ **CRITICAL**: This project runs on usage-based Cloudflare services with limited budget.

**See `instructions/load-testing.instructions.md` for detailed safety rules.**

Key requirements:
- NEVER run load tests on remote environments without explicit user confirmation
- Explain target environment, traffic scale, billing impact, and cleanup plan before requesting approval
- Production load tests require reconfirmation even if user gave prior general approval

### Code Quality

- **Format**: Prettier with Svelte + Tailwind plugins
- **Lint**: ESLint flat config
- **Type Check**: TypeScript strict mode
- **Edge Compatibility**: All `apps/api` code must be Cloudflare Workers compatible

---

## Adding New Instructions

1. Create `instructions/my-pattern.instructions.md`
2. Define when it should apply (file patterns, keywords)
3. Document the pattern with examples
4. Test by editing relevant code

## Adding New Prompts

1. Create `prompts/my-command.prompt.md`
2. Define the template structure
3. Include examples and expected output
4. Document in this README

## Adding New Agents

1. Create `agents/my-agent.agent.md`
2. Define agent capabilities and constraints
3. Specify invocation syntax
4. Document in this README

---

## Resources

- [Hono Documentation](https://hono.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [SvelteKit](https://kit.svelte.dev/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [OpenAPI Specification](https://swagger.io/specification/)

---

## Support

For issues or questions:
1. Check this README
2. Review relevant instruction files
3. Check project documentation in `/docs`
4. Ask in team chat
