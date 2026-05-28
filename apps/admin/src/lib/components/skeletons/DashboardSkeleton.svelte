<div class="space-y-8">
  <div
    class="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
  >
    <div
      class="grid gap-8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.96)_45%,rgba(251,191,36,0.10)_100%)] p-8 sm:p-10 xl:grid-cols-[1.15fr_0.85fr]"
    >
      <div class="space-y-4">
        <div class="h-4 w-8 animate-pulse rounded-lg bg-slate-200"></div>
        <div class="h-12 w-80 animate-pulse rounded-2xl bg-slate-200"></div>
        <div class="h-6 w-full max-w-3xl animate-pulse rounded-xl bg-slate-200"></div>
      </div>

      <div
        class="rounded-[1.75rem] border border-slate-900/10 bg-slate-950 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.24)]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 space-y-3">
            <div class="h-4 w-40 animate-pulse rounded-lg bg-white/20"></div>
            <div class="h-10 w-24 animate-pulse rounded-xl bg-white/20"></div>
            <div class="h-4 w-full animate-pulse rounded-lg bg-white/15"></div>
          </div>
          <div class="size-11 animate-pulse rounded-2xl bg-white/10"></div>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <div class="space-y-2 rounded-2xl border border-white/10 bg-white/6 p-4">
            <div class="h-3 w-16 animate-pulse rounded bg-white/15"></div>
            <div class="h-6 w-20 animate-pulse rounded-lg bg-white/20"></div>
          </div>
          <div class="space-y-2 rounded-2xl border border-white/10 bg-white/6 p-4">
            <div class="h-3 w-20 animate-pulse rounded bg-white/15"></div>
            <div class="h-6 w-28 animate-pulse rounded-lg bg-white/20"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {#each Array.from({ length: 6 }) as _, index (index)}
      <div class="rounded-[1.75rem] border border-slate-200/80 bg-white p-6 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 space-y-3">
            <div class="h-4 w-24 animate-pulse rounded-lg bg-slate-200"></div>
            <div class="h-9 w-28 animate-pulse rounded-xl bg-slate-200"></div>
          </div>
          <div class="size-12 animate-pulse rounded-2xl bg-slate-100"></div>
        </div>
      </div>
    {/each}
  </div>

  <div
    class="rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
  >
    <div class="mb-6 space-y-2">
      <div class="h-6 w-40 animate-pulse rounded-xl bg-slate-200"></div>
      <div class="h-4 w-96 animate-pulse rounded-lg bg-slate-200"></div>
    </div>

    <div
      class="rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(239,246,255,0.85),rgba(255,255,255,1))] p-4 sm:p-5"
    >
      <div class="h-64 w-full animate-pulse rounded-xl bg-slate-200"></div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        {#each Array.from({ length: 3 }) as _, index (index)}
          <div class="h-4 w-20 animate-pulse rounded bg-slate-200"></div>
        {/each}
      </div>
    </div>
  </div>

  <div class="grid gap-6 xl:grid-cols-2">
    <div
      class="rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
    >
      <div class="mb-6 space-y-2">
        <div class="h-6 w-32 animate-pulse rounded-xl bg-slate-200"></div>
        <div class="h-4 w-64 animate-pulse rounded-lg bg-slate-200"></div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr class="text-slate-500">
              <th class="px-4 py-3">
                <div class="h-4 w-16 animate-pulse rounded bg-slate-200"></div>
              </th>
              <th class="px-4 py-3">
                <div class="h-4 w-16 animate-pulse rounded bg-slate-200"></div>
              </th>
              <th class="px-4 py-3">
                <div class="h-4 w-16 animate-pulse rounded bg-slate-200"></div>
              </th>
              <th class="px-4 py-3">
                <div class="h-4 w-20 animate-pulse rounded bg-slate-200"></div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each Array.from({ length: 5 }) as _, index (index)}
              <tr>
                <td class="px-4 py-4">
                  <div class="h-4 w-40 animate-pulse rounded-lg bg-slate-200"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="h-4 w-24 animate-pulse rounded-lg bg-slate-200"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="h-5 w-20 animate-pulse rounded-full bg-slate-200"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="h-4 w-32 animate-pulse rounded-lg bg-slate-200"></div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div
      class="rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
    >
      <div class="mb-6 space-y-2">
        <div class="h-6 w-40 animate-pulse rounded-xl bg-slate-200"></div>
        <div class="h-4 w-80 animate-pulse rounded-lg bg-slate-200"></div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr class="text-slate-500">
              <th class="px-4 py-3">
                <div class="h-4 w-28 animate-pulse rounded bg-slate-200"></div>
              </th>
              <th class="px-4 py-3">
                <div class="h-4 w-16 animate-pulse rounded bg-slate-200"></div>
              </th>
              <th class="px-4 py-3">
                <div class="h-4 w-16 animate-pulse rounded bg-slate-200"></div>
              </th>
              <th class="px-4 py-3">
                <div class="h-4 w-16 animate-pulse rounded bg-slate-200"></div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each Array.from({ length: 5 }) as _, index (index)}
              <tr>
                <td class="px-4 py-4">
                  <div class="h-4 w-32 animate-pulse rounded-lg bg-slate-200"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="h-4 w-24 animate-pulse rounded-lg bg-slate-200"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="h-4 w-28 animate-pulse rounded-lg bg-slate-200"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="h-5 w-20 animate-pulse rounded-full bg-slate-200"></div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
