<script lang="ts">
  import EventCardSkeleton from './EventCardSkeleton.svelte';
</script>

<!-- Featured Events Section -->
<section id="featured" class="py-8 sm:py-10">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div class="space-y-3">
      <div class="h-4 w-32 animate-pulse rounded bg-slate-200"></div>
      <div class="h-8 w-80 animate-pulse rounded-lg bg-slate-200"></div>
    </div>
    <div class="h-5 w-32 animate-pulse rounded bg-slate-200"></div>
  </div>

  <div class="mt-6 grid gap-5 lg:grid-cols-3">
    {#each Array(3) as _, i (i)}
      <EventCardSkeleton />
    {/each}
  </div>
</section>

<!-- Categories Section -->
<section class="py-8 sm:py-10">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div class="space-y-3">
      <div class="h-4 w-36 animate-pulse rounded bg-slate-200"></div>
      <div class="h-8 w-96 animate-pulse rounded-lg bg-slate-200"></div>
    </div>
    <div class="flex items-center gap-2">
      <div class="h-4 w-4 animate-pulse rounded bg-slate-200"></div>
      <div class="h-4 w-64 animate-pulse rounded bg-slate-200"></div>
    </div>
  </div>

  <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each Array(4) as _, i (i)}
      <div
        class="rounded-[1.75rem] border border-white/80 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]"
      >
        <div class="size-12 animate-pulse rounded-2xl bg-slate-200"></div>
        <div class="mt-5 space-y-3">
          <div class="h-6 w-32 animate-pulse rounded-lg bg-slate-200"></div>
          <div class="space-y-2">
            <div class="h-4 w-full animate-pulse rounded bg-slate-100"></div>
            <div class="h-4 w-3/4 animate-pulse rounded bg-slate-100"></div>
          </div>
        </div>
        <div class="mt-5 flex items-center justify-between">
          <div class="h-4 w-24 animate-pulse rounded bg-slate-100"></div>
          <div class="size-4 animate-pulse rounded bg-slate-100"></div>
        </div>
      </div>
    {/each}
  </div>
</section>

<!-- Upcoming Events Section -->
<section class="py-8 sm:py-10">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div class="space-y-3">
      <div class="h-4 w-28 animate-pulse rounded bg-slate-200"></div>
      <div class="h-8 w-96 animate-pulse rounded-lg bg-slate-200"></div>
    </div>
    <div class="h-5 w-36 animate-pulse rounded bg-slate-200"></div>
  </div>

  <div class="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
    {#each Array(4) as _, i (i)}
      <EventCardSkeleton compact={true} />
    {/each}
  </div>
</section>
