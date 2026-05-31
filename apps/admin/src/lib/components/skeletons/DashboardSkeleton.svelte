<div class="space-y-8">
  <div
    class="border-border bg-card overflow-hidden rounded-[2rem] border shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
  >
    <div class="grid gap-8 bg-[var(--gradient-section)] p-8 sm:p-10 xl:grid-cols-[1.15fr_0.85fr]">
      <div class="space-y-4">
        <div class="bg-muted h-4 w-8 animate-pulse rounded-lg"></div>
        <div class="bg-muted h-12 w-80 animate-pulse rounded-2xl"></div>
        <div class="bg-muted h-6 w-full max-w-3xl animate-pulse rounded-xl"></div>
      </div>

      <div
        class="bg-foreground text-background rounded-[1.75rem] border border-slate-900/10 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.24)]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 space-y-3">
            <div class="bg-card/20 h-4 w-40 animate-pulse rounded-lg"></div>
            <div class="bg-card/20 h-10 w-24 animate-pulse rounded-xl"></div>
            <div class="bg-card/15 h-4 w-full animate-pulse rounded-lg"></div>
          </div>
          <div class="bg-card/10 size-11 animate-pulse rounded-2xl"></div>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <div class="bg-card/6 space-y-2 rounded-2xl border border-white/10 p-4">
            <div class="bg-card/15 h-3 w-16 animate-pulse rounded"></div>
            <div class="bg-card/20 h-6 w-20 animate-pulse rounded-lg"></div>
          </div>
          <div class="bg-card/6 space-y-2 rounded-2xl border border-white/10 p-4">
            <div class="bg-card/15 h-3 w-20 animate-pulse rounded"></div>
            <div class="bg-card/20 h-6 w-28 animate-pulse rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {#each Array.from({ length: 6 }) as _, index (index)}
      <div class="border-border bg-card rounded-[1.75rem] border p-6 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 space-y-3">
            <div class="bg-muted h-4 w-24 animate-pulse rounded-lg"></div>
            <div class="bg-muted h-9 w-28 animate-pulse rounded-xl"></div>
          </div>
          <div class="bg-muted/80 size-12 animate-pulse rounded-2xl"></div>
        </div>
      </div>
    {/each}
  </div>

  <div
    class="border-border bg-card/95 rounded-[2rem] border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
  >
    <div class="mb-6 space-y-2">
      <div class="bg-muted h-6 w-40 animate-pulse rounded-xl"></div>
      <div class="bg-muted h-4 w-96 animate-pulse rounded-lg"></div>
    </div>

    <div class="border-border rounded-[1.6rem] border bg-[var(--gradient-section-alt)] p-4 sm:p-5">
      <div class="bg-muted h-64 w-full animate-pulse rounded-xl"></div>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        {#each Array.from({ length: 3 }) as _, index (index)}
          <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
        {/each}
      </div>
    </div>
  </div>

  <div class="grid gap-6 xl:grid-cols-2">
    <div
      class="border-border bg-card/95 rounded-[2rem] border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
    >
      <div class="mb-6 space-y-2">
        <div class="bg-muted h-6 w-32 animate-pulse rounded-xl"></div>
        <div class="bg-muted h-4 w-64 animate-pulse rounded-lg"></div>
      </div>

      <div class="overflow-x-auto">
        <table class="divide-border min-w-full divide-y text-left text-sm">
          <thead>
            <tr class="text-muted-foreground">
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
          <tbody class="divide-border divide-y">
            {#each Array.from({ length: 5 }) as _, index (index)}
              <tr>
                <td class="px-4 py-4">
                  <div class="bg-muted h-4 w-40 animate-pulse rounded-lg"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="bg-muted h-4 w-24 animate-pulse rounded-lg"></div>
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

    <div
      class="border-border bg-card/95 rounded-[2rem] border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
    >
      <div class="mb-6 space-y-2">
        <div class="bg-muted h-6 w-40 animate-pulse rounded-xl"></div>
        <div class="bg-muted h-4 w-80 animate-pulse rounded-lg"></div>
      </div>

      <div class="overflow-x-auto">
        <table class="divide-border min-w-full divide-y text-left text-sm">
          <thead>
            <tr class="text-muted-foreground">
              <th class="px-4 py-3">
                <div class="bg-muted h-4 w-28 animate-pulse rounded"></div>
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
            </tr>
          </thead>
          <tbody class="divide-border divide-y">
            {#each Array.from({ length: 5 }) as _, index (index)}
              <tr>
                <td class="px-4 py-4">
                  <div class="bg-muted h-4 w-32 animate-pulse rounded-lg"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="bg-muted h-4 w-24 animate-pulse rounded-lg"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="bg-muted h-4 w-28 animate-pulse rounded-lg"></div>
                </td>
                <td class="px-4 py-4">
                  <div class="bg-muted h-5 w-20 animate-pulse rounded-full"></div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
