<div class="space-y-8">
  <div
    class="bg-card/90 rounded-[2rem] border border-slate-200/80 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <div class="bg-muted h-4 w-8 animate-pulse rounded-lg"></div>
        <div class="bg-muted h-12 w-96 animate-pulse rounded-2xl"></div>
        <div class="bg-muted h-5 w-full max-w-3xl animate-pulse rounded-xl"></div>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="bg-muted h-10 w-28 animate-pulse rounded-lg"></div>
        <div class="bg-muted h-10 w-32 animate-pulse rounded-lg"></div>
      </div>
    </div>

    <div class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {#each Array.from({ length: 4 }) as _, index (index)}
        <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
          <div class="bg-muted h-4 w-24 animate-pulse rounded-lg"></div>
          <div class="bg-muted mt-3 h-9 w-20 animate-pulse rounded-xl"></div>
        </div>
      {/each}
    </div>
  </div>

  <div class="rounded-[2rem] border border-slate-200/80 bg-white/95 p-6 shadow-sm">
    <div class="mb-6 space-y-2">
      <div class="bg-muted h-6 w-32 animate-pulse rounded-xl"></div>
      <div class="bg-muted h-4 w-full max-w-2xl animate-pulse rounded-lg"></div>
    </div>

    <div class="mb-5 flex flex-wrap gap-2">
      {#each Array.from({ length: 5 }) as _, index (index)}
        <div class="bg-muted h-9 w-28 animate-pulse rounded-full"></div>
      {/each}
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead>
          <tr class="text-slate-500">
            <th class="px-4 py-3">
              <div class="bg-muted h-4 w-16 animate-pulse rounded"></div>
            </th>
            <th class="px-4 py-3">
              <div class="bg-muted h-4 w-16 animate-pulse rounded"></div>
            </th>
            <th class="px-4 py-3">
              <div class="bg-muted h-4 w-20 animate-pulse rounded"></div>
            </th>
            <th class="px-4 py-3 text-right">
              <div class="bg-muted ml-auto h-4 w-28 animate-pulse rounded"></div>
            </th>
            <th class="px-4 py-3 text-right">
              <div class="bg-muted ml-auto h-4 w-16 animate-pulse rounded"></div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {#each Array.from({ length: 6 }) as _, index (index)}
            <tr>
              <td class="px-4 py-4">
                <div class="space-y-1">
                  <div class="bg-muted h-4 w-48 animate-pulse rounded-lg"></div>
                  <div class="bg-muted h-3 w-24 animate-pulse rounded"></div>
                </div>
              </td>
              <td class="px-4 py-4">
                <div class="bg-muted h-5 w-20 animate-pulse rounded-full"></div>
              </td>
              <td class="px-4 py-4">
                <div class="space-y-1">
                  <div class="bg-muted h-4 w-56 animate-pulse rounded-lg"></div>
                  <div class="bg-muted h-3 w-48 animate-pulse rounded"></div>
                </div>
              </td>
              <td class="px-4 py-4 text-right">
                <div class="ml-auto space-y-2">
                  <div class="bg-muted ml-auto h-4 w-16 animate-pulse rounded-lg"></div>
                  <div class="bg-muted ml-auto h-2 w-28 animate-pulse rounded-full"></div>
                </div>
              </td>
              <td class="px-4 py-4 text-right">
                <div class="ml-auto flex justify-end gap-2">
                  <div class="bg-muted h-8 w-20 animate-pulse rounded-lg"></div>
                  <div class="bg-muted h-8 w-16 animate-pulse rounded-lg"></div>
                  <div class="bg-muted h-8 w-16 animate-pulse rounded-lg"></div>
                  <div class="bg-muted h-8 w-20 animate-pulse rounded-lg"></div>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</div>
