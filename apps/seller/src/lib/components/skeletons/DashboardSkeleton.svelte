<div class="space-y-8">
  <div
    class="bg-card/92 overflow-hidden rounded-[2rem] border border-emerald-950/10 shadow-[0_30px_90px_rgba(5,46,34,0.10)]"
  >
    <div class="grid gap-8 bg-[var(--gradient-section)] p-8 sm:p-10 xl:grid-cols-[1.15fr_0.85fr]">
      <div class="space-y-4">
        <div class="h-4 w-12 animate-pulse rounded-lg bg-emerald-200/60"></div>
        <div class="bg-muted h-12 w-80 animate-pulse rounded-2xl"></div>
        <div class="bg-muted h-6 w-full max-w-3xl animate-pulse rounded-xl"></div>
      </div>

      <div
        class="bg-foreground text-background rounded-[1.75rem] border border-emerald-950/10 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.25)]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 space-y-3">
            <div class="bg-card/20 h-4 w-32 animate-pulse rounded-lg"></div>
            <div class="bg-card/20 h-10 w-24 animate-pulse rounded-xl"></div>
            <div class="bg-card/15 h-4 w-full animate-pulse rounded-lg"></div>
          </div>
          <div class="bg-card/10 size-11 animate-pulse rounded-2xl"></div>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <div class="bg-card/6 space-y-2 rounded-2xl border border-white/10 p-4">
            <div class="bg-card/15 h-3 w-20 animate-pulse rounded"></div>
            <div class="bg-card/20 h-6 w-28 animate-pulse rounded-lg"></div>
          </div>
          <div class="bg-card/6 space-y-2 rounded-2xl border border-white/10 p-4">
            <div class="bg-card/15 h-3 w-20 animate-pulse rounded"></div>
            <div class="bg-card/20 h-6 w-24 animate-pulse rounded-lg"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2">
    {#each Array.from({ length: 4 }) as _, index (index)}
      <div class="border-border bg-card rounded-[1.7rem] border p-6 shadow-sm">
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
    class="border-border bg-card/95 rounded-[2rem] border p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
  >
    <div class="mb-6 space-y-2">
      <div class="bg-muted h-6 w-40 animate-pulse rounded-xl"></div>
      <div class="bg-muted h-4 w-96 animate-pulse rounded-lg"></div>
    </div>

    <div class="overflow-x-auto">
      <table class="divide-border min-w-full divide-y text-left text-sm">
        <thead>
          <tr class="text-muted-foreground">
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
        <tbody class="divide-border divide-y">
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
