# Visual Review — Project Lessons (Jeevatix)

This file feeds the visual-review tool's LLM with project-specific context. The LLM MUST respect these rules. Do NOT recommend approaches the user has previously rejected.

---

## User-rejected design directions

These were tried and explicitly rejected. Do NOT recommend reverting to them.

### Editorial Confidence aesthetic (REJECTED — see PRs #30/#31/#33/#34)

The following combinations were tested cross-portal and rejected:

- `rounded-2xl` chunky corners on Buttons. User finds them "kotak"/blocky. Pill `rounded-full` is preferred.
- Sharp solid black offset shadow `0 2px 0 0 var(--foreground)` and `0 6px 0 0 var(--foreground)`. User reads them as "border hitam"/"shadow jelek". Soft warm shadow (`--shadow-float`) is preferred.
- `bg-foreground text-background` (near-black solid) for primary CTAs. Too "corporate"/"business" for the warm event-marketplace identity.
- Hover `translate-y-[-2px]` lift with shadow grow. Reads as "smear-blob ink-spillage" when shadow grows during hover. Hover should be transform-only OR very subtle.

DO NOT propose: editorial geometry, brutalist shadows, sharp offset shadows, monochrome buttons, lift-grow hovers.

### Bright yellow gradient stops (REJECTED — see PR #28)

`linear-gradient(135deg, #f97316, #facc15)` (orange-500 → yellow-400) failed WCAG AA at the yellow stop with white text (1.53:1). Even when fixed with dark text, user disliked the visual ("style menjadi lebih jelek"). Replaced with `from-jeevatix-600 to-jeevatix-700` (orange-600 → orange-700, AA-large pass with white).

DO NOT propose: gradients ending in yellow-300/400, amber-400 with white text, or bright-stop gradients without a contrast safety check.

### Sample text bumping that loses hierarchy

User accepted bumping `text-[0.65rem] tracking-[0.26em]` to `text-[0.7rem] tracking-[0.22em]` in PR #28. Don't bump beyond `text-[0.75rem]` for eyebrow/section labels — it'd break visual hierarchy with `text-sm` content text.

---

## Brand identity (RESPECT)

- **Primary brand color**: jeevatix-600 (#ea580c, equivalent to orange-600). jeevatix-700 (#c2410c) for hover/dark stop.
- **Secondary brand**: sea-700 (used in `secondary` Button variant)
- **Vibe**: warm, lush, inviting, event-marketplace energy. NOT enterprise, NOT corporate, NOT brutalist.
- **Hero CTAs**: pill shape (`rounded-full`), gradient `from-jeevatix-600 to-jeevatix-700`, scale-105 hover (no shadow grow).
- **Other Buttons**: warm pill default via Button.svelte (post-PR #34 revert).
- **Semantic variants**: `success` (emerald) for approve, `destructive` (red) for reject/delete. Used in admin moderation flows.

---

## Approved patterns (current shipped state)

- Hero CTA buyer landing: `from-jeevatix-600 to-jeevatix-700 h-14 rounded-full text-lg font-bold` with warm `--shadow-float`, scale-105 hover, no shadow grow.
- Gradient text in hero headline ("menggerakkan hatimu"): use `bg-[image:var(--gradient-brand)]` (NOT `bg-[var(--gradient-brand)]`) for Tailwind v4 compatibility — the latter compiles to invalid `background-color` declaration.
- Default Button: `bg-jeevatix-600 rounded-full text-white shadow-[var(--shadow-float)] hover:bg-jeevatix-700`.
- Section/page backgrounds: `bg-[var(--gradient-page)]`, `bg-[var(--gradient-section)]`, etc. (NOTE: these have the same Tailwind v4 compile bug as gradient text but currently masked by parent fallbacks. Out of scope unless visually broken.)

---

## Out-of-scope items (do NOT raise as issues)

- Pre-existing typecheck errors for `PUBLIC_API_BASE_URL` static-import (~16 errors, handoff lines 327-330). Don't suggest "fix typecheck".
- 34 instances of `bg-[var(--gradient-X)]` page/section backgrounds with same Tailwind v4 compile bug — page/section bg, not user-visible. Ignore.
- E2E test suite doesn't assert console errors. Known. Out-of-scope unless directly relevant to a visual issue.
- 13 stale remote branches. Repo hygiene. Not visual.

---

## Heuristic priorities (in order)

1. **Contrast** — already covered by deterministic check, you augment with patterns ("multiple CTAs share fail")
2. **Hierarchy** — primary CTA visually prominent vs secondary?
3. **Touch target** — interactive elements ≥44x44px?
4. **Predictability** — hover/focus state visible?
5. **Brand coherence** — does the element feel "Jeevatix"-warm or alien?
6. **Density** — overcrowded zones?

If you see a fix that contradicts the user-rejected list above, either skip it or note explicitly: "User rejected this approach in PR #X — alternative: …"
