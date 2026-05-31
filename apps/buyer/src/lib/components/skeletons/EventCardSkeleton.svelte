<script lang="ts">
  import { cn } from '$lib/utils';

  let { compact = false, class: className }: { compact?: boolean; class?: string } = $props();
</script>

<div
  class={cn(
    'border-border bg-card/90 block overflow-hidden rounded-[1.75rem] border shadow-[0_18px_60px_rgba(15,23,42,0.08)]',
    compact ? 'h-full' : '',
    className,
  )}
>
  <div class={cn('relative overflow-hidden', compact ? 'aspect-[4/3]' : 'aspect-[16/10]')}>
    <div class="bg-muted h-full w-full animate-pulse"></div>

    <div class="absolute top-4 left-4 flex flex-wrap gap-2">
      <div
        class="h-7 w-20 animate-pulse rounded-full border border-white/30 bg-card/15 backdrop-blur"
      ></div>
    </div>

    <div class="absolute inset-x-0 bottom-0 space-y-3 p-4 sm:p-5">
      <div class="h-3 w-24 animate-pulse rounded-full bg-card/30"></div>
      <div class="space-y-2">
        <div class="h-6 w-3/4 animate-pulse rounded-lg bg-card/40"></div>
        <div class="h-6 w-1/2 animate-pulse rounded-lg bg-card/40"></div>
      </div>
    </div>
  </div>

  <div class="space-y-4 p-5 sm:p-6">
    <div class="flex flex-wrap gap-3">
      <div class="bg-muted/80 h-8 w-32 animate-pulse rounded-full"></div>
      <div class="bg-muted/80 h-8 w-28 animate-pulse rounded-full"></div>
    </div>

    <div class="space-y-2">
      <div class="bg-muted/80 h-4 w-full animate-pulse rounded"></div>
      <div class="bg-muted/80 h-4 w-5/6 animate-pulse rounded"></div>
    </div>

    <div class="flex items-end justify-between gap-4 border-t border-border pt-4">
      <div class="space-y-2">
        <div class="bg-muted/80 h-3 w-20 animate-pulse rounded"></div>
        <div class="bg-muted h-6 w-28 animate-pulse rounded"></div>
      </div>
      <div class="bg-muted/80 h-5 w-24 animate-pulse rounded"></div>
    </div>
  </div>
</div>
