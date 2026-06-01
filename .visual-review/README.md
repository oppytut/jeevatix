# .visual-review/

Project-local context for the global `visual-review` tool. Tool runs Playwright capture (light + dark) → deterministic WCAG contrast → Bansos opus-4.7 LLM review → markdown + JSON report.

## Files

| File                     | Purpose                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lessons.md`             | Project-specific design rules + rejected approaches. Fed to the LLM during review so it doesn't re-suggest patterns the user already rejected.                                                      |
| `routes.json`            | Routes audited by `visual-review-batch`. Starter set covers public buyer surfaces. Add entries to expand coverage.                                                                                  |
| `agents.json` (optional) | Override default model chain for this project. Combo pattern — declare role, primary model, and fallback chain. Falls back transparently if primary unavailable. See global README for full schema. |
| `README.md`              | This file. Quick reference for running the tool from the project root.                                                                                                                              |

## Run from project root

```bash
# Single page — auto-picks up lessons.md + agents.json
visual-review https://jeevatix.my.id

# Multiple pages — auto-picks up routes.json + lessons.md + agents.json
visual-review-batch
```

Output goes to `/tmp/visual-review-<timestamp>/` for single-page, `/tmp/visual-review-batch-<timestamp>/` for batch.

## Run staging health-check first

```bash
# Verify staging is up before reviewing
curl -s https://jeevatix-staging-api.ariefna95.workers.dev/health | jq
visual-review https://jeevatix.my.id
```

## Sample findings (PR #37 → #38)

Tool was first run during PR #37 → #38 (visual-review tooling + post-review fixes). Real findings on `jeevatix.my.id`:

| Severity | Category       | Finding                                                                                                                     | Resolution                                          |
| -------- | -------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| critical | contrast       | EventCard image-overlay scrim used `from-foreground/70` → near-WHITE in light mode → titles invisible on top of card images | PR #38: `from-black/75 via-black/30 to-transparent` |
| high     | consistency    | Duplicate `Login` link (nav cluster + auth cluster)                                                                         | PR #38: drop from nav cluster                       |
| high     | touch-target   | Nav links 20px tall (need ≥44px)                                                                                            | PR #38: `py-2` (20px → 36px)                        |
| high     | predictability | `Lihat semua event` hover same color as default                                                                             | PR #38: `hover:text-jeevatix-600 hover:underline`   |
| high     | brand          | `text-amber-300` accent — rejected per `lessons.md`                                                                         | PR #38: `text-jeevatix-300`                         |
| medium   | other          | Nested `<a><button>` hero CTA → 2 interactives at same rect                                                                 | PR #38: collapse to single `<a>`                    |

After-fix re-run confirmed **4 of 6** LLM findings disappeared. Image scrim still flagged due to tool limitation (can't see stacked overlays).

## Batch run findings (4 routes)

After PR #38 fixes, first batch run on `[/, /events, /login, /register]` (88s via concurrency=3):

```
46 LLM issues across 4 routes
  critical: 6  | high: 13  | medium: 15  | low: 12

Top systemic patterns:
- jeevatix-600 button 3.56:1 — appears on landing + events + login + register
- FEATURED/PUBLISHED badge contrast — same fail across event cards
- Image overlay scrim — same issue on all listing routes
- Touch target 40px theme toggle — appears in shared header
```

Batch surfaces patterns single-page reviews miss.

## Model selection (combo pattern)

The tool uses **abstract role mapping**, not specific model names. Default chain:

```
design-reviewer:
  primary:        visual-engineering    # domain-tuned for UI/UX
  fallback_chain:
    - unspecified-high                  # high-effort general
    - kr/claude-opus-4.7                # specific Claude opus
    - kr/claude-opus-4.6
    - kr/claude-sonnet-4.6
```

Why combo? When `kr/claude-opus-4.7` is unavailable (quota exhausted, deprecated, proxy upstream change), the tool transparently tries the next model. No code change, no manual swap. Same pattern as `~/.config/opencode/oh-my-openagent.json`.

The chosen model is logged in `report.md` header + saved to `llm-attempts.json` for observability.

### Override per project

Drop `.visual-review/agents.json` to override:

```json
{
  "design-reviewer": {
    "primary": "artistry",
    "fallback_chain": ["visual-engineering", "kr/claude-opus-4.7"]
  }
}
```

Project config deep-merges over the global default.

## Lessons file maintenance

Update `lessons.md` whenever:

- A design direction is rejected ("we tried X and the user said no") — add to "rejected" section
- Brand identity rules change (new color tokens, new variants)
- A pattern becomes canonical ("hero CTA is always `from-jeevatix-600 to-jeevatix-700`")
- An issue should be ignored ("don't recommend Y because of legacy reason Z")

The LLM reads this file as authoritative project context. Keep it concise — too long dilutes signal.

## Full tool docs

See `~/.config/opencode/tools/visual-review/README.md` for:

- Full setup instructions
- All CLI flags
- Output structure breakdown
- Troubleshooting common issues
- Extending the tool to other projects
- CI integration sketch
- Future: vision augmentation roadmap

## Gitignore

This directory is **committed** — `lessons.md` is project context that should be tracked. Tool output goes to `/tmp/`, never here, so no `.gitignore` rules needed for output artifacts.
