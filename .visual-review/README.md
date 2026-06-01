# .visual-review/

Project-local context for the global `visual-review` tool installed at `~/.config/opencode/tools/visual-review/`.

## Files

- **lessons.md** — Project-specific design rules + rejected approaches. Fed to the LLM during review so it doesn't recommend approaches the user has previously rejected.

## Quick run

```bash
# From project root, picks up lessons.md automatically
visual-review https://jeevatix.my.id

# Output goes to /tmp/visual-review-<timestamp>/
# Open report.md to read findings
```

## Adding to gitignore

This directory contains project context that should be committed (lessons.md is reference material). Output goes to `/tmp/`, not here, so no extra ignore rules needed.
