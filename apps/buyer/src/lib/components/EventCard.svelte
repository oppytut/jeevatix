<script lang="ts">
  import { resolve } from '$app/paths';
  import { CalendarDays, MapPin, Ticket } from '@lucide/svelte';

  import type { PublicEventListItem } from '$lib/api';
  import { cn, formatCurrency, formatShortEventDate } from '$lib/utils';

  let {
    event,
    compact = false,
    class: className,
  }: {
    event: PublicEventListItem;
    compact?: boolean;
    class?: string;
  } = $props();

  const fallbackBanner =
    'linear-gradient(135deg, rgba(249,115,22,0.92), rgba(251,191,36,0.82) 45%, rgba(14,165,233,0.78))';
</script>

<a
  href={resolve('/events/[slug]', { slug: event.slug })}
  class={cn(
    'group focus-visible:ring-ring/40 bg-card/90 dark:border-border block overflow-hidden rounded-[1.75rem] border border-white/80 shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_80px_rgba(15,23,42,0.16)] focus-visible:ring-4 focus-visible:outline-none',
    compact ? 'h-full' : '',
    className,
  )}
>
  <div class={cn('relative overflow-hidden', compact ? 'aspect-[4/3]' : 'aspect-[16/10]')}>
    {#if event.banner_url}
      <img
        src={event.banner_url}
        alt={event.title}
        width="800"
        height={compact ? 600 : 500}
        loading="lazy"
        decoding="async"
        class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
    {:else}
      <div class="h-full w-full" style={`background:${fallbackBanner};`}></div>
    {/if}

    <div
      class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent"
    ></div>

    <div class="absolute top-4 left-4 flex flex-wrap gap-2">
      {#if event.is_featured}
        <span
          class="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-white uppercase backdrop-blur"
        >
          Featured
        </span>
      {/if}
      <span
        class="rounded-full border border-white/30 bg-slate-950/30 px-3 py-1 text-[11px] font-semibold tracking-[0.2em] text-white uppercase backdrop-blur"
      >
        {event.status === 'ongoing' ? 'Ongoing' : 'Published'}
      </span>
    </div>

    <div class="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
      <p class="text-xs font-semibold tracking-[0.26em] text-white/70 uppercase">
        {event.venue_city}
      </p>
      <h2 class="mt-2 line-clamp-2 text-xl font-semibold tracking-tight sm:text-2xl">
        {event.title}
      </h2>
    </div>
  </div>

  <div class="space-y-4 p-5 sm:p-6">
    <div class="text-muted-foreground flex flex-wrap gap-3 text-sm">
      <span class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
        <CalendarDays class="size-4 text-orange-600" />
        {formatShortEventDate(event.start_at)}
      </span>
      <span class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
        <MapPin class="size-4 text-sky-600" />
        {event.venue_city}
      </span>
    </div>

    <p class="text-muted-foreground line-clamp-2 text-sm leading-6">
      {event.description ??
        `Event di ${event.venue_name} dengan akses tiket hingga ${event.max_tickets_per_order} per order.`}
    </p>

    <div class="flex items-end justify-between gap-4 border-t border-slate-100 pt-4">
      <div>
        <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
          Mulai dari
        </p>
        <p class="text-foreground mt-1 text-lg font-semibold sm:text-xl">
          {formatCurrency(event.min_price)}
        </p>
      </div>

      <span
        class="text-muted-foreground group-hover:text-foreground inline-flex items-center gap-2 text-sm font-medium transition"
      >
        <Ticket class="size-4 text-orange-600" />
        Lihat Detail
      </span>
    </div>
  </div>
</a>
