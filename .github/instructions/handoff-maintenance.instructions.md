---
description: "Use when finishing a working session, changing physical environments, wrapping up tasks for the day, or creating a handoff explicitly.
This instruction ensures the workspace context survives across different laptops using the same VS Code Remote SSH server."
---

# Handoff Maintenance Protocol

Since the developer frequently switches physical laptops while preserving the same remote SSH server state, preserving context in the codebase is strictly required to prevent context loss between sessions.

Whenever the developer indicates they are:
- "selesai untuk saat ini" (done for now)
- "mau ganti laptop" (switching laptops)
- "istirahat" (taking a break)
- "buatkan handoff" (create handoff)
...or completing a major task milestone.

You must:
1. Automatically save the current active context into `handoff.md` located at the workspace root before answering.
2. Update the `last_updated: YYYY-MM-DD` in the YAML frontmatter.
3. Record the overarching `phase` and `status` from `DEVELOPMENT_PLAN.md` or similar epic trackers.
4. Record exactly:
   - What was just finished (`[DONE]`).
   - What is currently partially working/failing (`[IN-PROGRESS] / [BLOCKER]`).
   - What the explicit "Next Steps" are for the next session.
5. Create a git commit for the updated `handoff.md` with message `chore(docs): update handoff state before session switch` automatically if there are no other uncommitted changes in the working tree, or prompt the user first if there are uncommitted application files.
