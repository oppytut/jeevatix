<script lang="ts">
  import EventCardSkeleton from './EventCardSkeleton.svelte';
</script>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div
    class="rounded-[2.25rem] border border-white/80 bg-[linear-gradient(135deg,#fff8ef_0%,#eef8ff_100%)] p-7 shadow-[0_26px_80px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <div class="h-4 w-28 animate-pulse rounded bg-slate-200"></div>
        <div class="h-9 w-96 animate-pulse rounded-lg bg-slate-200"></div>
        <div class="space-y-2">
          <div class="h-4 w-full max-w-2xl animate-pulse rounded bg-slate-100"></div>
          <div class="h-4 w-3/4 max-w-xl animate-pulse rounded bg-slate-100"></div>
        </div>
      </div>

      <div class="h-9 w-40 animate-pulse rounded-full bg-white/80"></div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
    <div
      class="space-y-6 rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
    >
      <div class="flex items-center gap-2">
        <div class="size-4 animate-pulse rounded bg-slate-200"></div>
        <div class="h-4 w-24 animate-pulse rounded bg-slate-200"></div>
      </div>

      <div class="space-y-3">
        <div class="h-4 w-16 animate-pulse rounded bg-slate-200"></div>
        <div class="h-12 w-full animate-pulse rounded-full bg-slate-100"></div>
      </div>

      <div class="space-y-3">
        <div class="h-4 w-20 animate-pulse rounded bg-slate-200"></div>
        <div class="flex flex-wrap gap-2">
          {#each Array(5) as _, i (i)}
            <div class="h-9 w-20 animate-pulse rounded-full bg-slate-100"></div>
          {/each}
        </div>
      </div>

      <div class="space-y-3">
        <div class="h-4 w-12 animate-pulse rounded bg-slate-200"></div>
        <div class="h-12 w-full animate-pulse rounded-2xl bg-slate-100"></div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div class="space-y-3">
          <div class="h-4 w-24 animate-pulse rounded bg-slate-200"></div>
          <div class="h-12 w-full animate-pulse rounded-2xl bg-slate-100"></div>
        </div>
        <div class="space-y-3">
          <div class="h-4 w-24 animate-pulse rounded bg-slate-200"></div>
          <div class="h-12 w-full animate-pulse rounded-2xl bg-slate-100"></div>
        </div>
      </div>

      <div class="space-y-4">
        <div class="h-4 w-28 animate-pulse rounded bg-slate-200"></div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="h-3 w-16 animate-pulse rounded bg-slate-100"></div>
              <div class="h-3 w-20 animate-pulse rounded bg-slate-100"></div>
            </div>
            <div class="h-2 w-full animate-pulse rounded-full bg-slate-200"></div>
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="h-3 w-20 animate-pulse rounded bg-slate-100"></div>
              <div class="h-3 w-24 animate-pulse rounded bg-slate-100"></div>
            </div>
            <div class="h-2 w-full animate-pulse rounded-full bg-slate-200"></div>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <div class="h-11 flex-1 animate-pulse rounded-full bg-slate-200"></div>
        <div class="h-11 flex-1 animate-pulse rounded-full bg-slate-100"></div>
      </div>
    </div>

    <div class="space-y-6">
      <div
        class="flex flex-col gap-3 rounded-[2rem] border border-white/80 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="space-y-3">
          <div class="h-4 w-16 animate-pulse rounded bg-slate-200"></div>
          <div class="h-6 w-48 animate-pulse rounded-lg bg-slate-200"></div>
        </div>
        <div class="h-4 w-56 animate-pulse rounded bg-slate-100"></div>
      </div>

      <div class="grid gap-5 xl:grid-cols-2">
        {#each Array(6) as _, i (i)}
          <EventCardSkeleton compact={true} />
        {/each}
      </div>
    </div>
  </div>
</section>
