<div class="space-y-8">
  <div
    class="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white/92 shadow-[0_30px_90px_rgba(5,46,34,0.10)]"
  >
    <div
      class="grid gap-8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_38%),linear-gradient(135deg,rgba(15,118,110,0.08),rgba(255,255,255,0.96)_44%,rgba(245,158,11,0.10)_100%)] p-8 sm:p-10 xl:grid-cols-[1.15fr_0.85fr]"
    >
      <div class="space-y-4">
        <div class="h-4 w-12 animate-pulse rounded-lg bg-emerald-200/60"></div>
        <div class="bg-muted h-12 w-80 animate-pulse rounded-2xl"></div>
        <div class="bg-muted h-6 w-full max-w-3xl animate-pulse rounded-xl"></div>
      </div>

      <div
        class="rounded-[1.75rem] border border-emerald-950/10 bg-slate-950 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.25)]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 space-y-3">
            <div class="h-4 w-32 animate-pulse rounded-lg bg-white/20"></div>
            <div class="h-10 w-24 animate-pulse rounded-xl bg-white/20"></div>
            <div class="h-4 w-full animate-pulse rounded-lg bg-white/15"></div>
          </div>
          <div class="size-11 animate-pulse rounded-2xl bg-white/10"></div>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <div class="space-y-2 rounded-2xl border border-white/10 bg-white/6 p-4">
            <div class="h-3 w-20 animate-pulse rounded bg-white/15"></div>
            <div class="h-6 w-28 animate-pulse rounded-lg bg-white/20"></div>
          </div>
          <div class="space-y-2 rounded-2xl border border-white/10 bg-white/6 p-4">
            <div class="h-3 w-20 animate-pulse rounded bg-white/15"></div>
            <div class="h-6 w-24 animate-pulse rounded-lg bg-white/20"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2">
    {#each Array.from({ length: 4 }) as _, index (index)}
      <div class="rounded-[1.7rem] border border-slate-200/80 bg-white p-6 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 space-y-3">
            <div class="bg-muted h-4 w-28 animate-pulse rounded-lg"></div>
            <div class="bg-muted h-9 w-32 animate-pulse rounded-xl"></div>
            <div class="bg-muted h-4 w-full animate-pulse rounded-lg"></div>
          </div>
          <div class="bg-muted/80 size-12 animate-pulse rounded-2xl"></div>
        </div>
      </div>
    {/each}
  </div>

  <div
    class="rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
  >
    <div class="mb-6 space-y-2">
      <div class="bg-muted h-6 w-40 animate-pulse rounded-xl"></div>
      <div class="bg-muted h-4 w-96 animate-pulse rounded-lg"></div>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead>
          <tr class="text-slate-500">
            <th class="px-4 py-3">
              <div class="bg-muted h-4 w-16 animate-pulse rounded"></div>
            </th>
            <th class="px-4 py-3">
              <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
            </th>
            <th class="px-4 py-3">
              <div class="bg-muted h-4 w-16 animate-pulse rounded"></div>
            </th>
            <th class="px-4 py-3">
              <div class="bg-muted h-4 w-16 animate-pulse rounded"></div>
            </th>
            <th class="px-4 py-3">
              <div class="bg-muted h-4 w-16 animate-pulse rounded"></div>
            </th>
            <th class="px-4 py-3">
              <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each Array.from({ length: 5 }) as _, index (index)}
            <tr>
              <td class="px-4 py-4">
                <div class="bg-muted h-4 w-28 animate-pulse rounded-lg"></div>
              </td>
              <td class="px-4 py-4">
                <div class="bg-muted h-4 w-36 animate-pulse rounded-lg"></div>
              </td>
              <td class="px-4 py-4">
                <div class="bg-muted h-4 w-24 animate-pulse rounded-lg"></div>
              </td>
              <td class="px-4 py-4">
                <div class="bg-muted h-4 w-20 animate-pulse rounded-lg"></div>
              </td>
              <td class="px-4 py-4">
                <div class="bg-muted h-5 w-20 animate-pulse rounded-full"></div>
              </td>
              <td class="px-4 py-4">
                <div class="bg-muted h-4 w-32 animate-pulse rounded-lg"></div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
