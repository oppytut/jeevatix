---
description: "Run phase checkpoint validation: build, lint, format check, and test. Use after completing all tasks in a development phase."
agent: "agent"
argument-hint: "Phase number to validate (e.g., 0, 1, 2)"
---
Jalankan validasi checkpoint untuk fase yang diminta dari DEVELOPMENT_PLAN.md.

## Steps

1. Baca `DEVELOPMENT_PLAN.md` bagian checkpoint fase yang diminta.

2. Jalankan command validasi secara berurutan:

```bash
# Code quality (wajib semua fase)
pnpm run format:check    # Prettier — cek formatting
pnpm run lint            # ESLint — cek lint errors

# Build & test
pnpm run build           # Semua app harus build sukses
pnpm run test            # Unit & integration tests (jika sudah ada)
```

3. Jalankan checkpoint spesifik per fase (lihat DEVELOPMENT_PLAN.md):
   - **Phase 0**: `pnpm install` sukses, `pnpm run dev` start semua app.
   - **Phase 1**: `pnpm drizzle-kit push` sukses, seed data masuk.
   - **Phase 2-9**: API endpoint bisa diakses, UI page ter-render.
   - **Phase 10**: `pnpm run test:e2e`, `pnpm run test:load`.

4. Report hasil:
   - ✅ Pass: command dan output sukses.
   - ❌ Fail: command, error message, dan saran fix.

## Output Format

Berikan summary tabel dengan status setiap checkpoint command.
