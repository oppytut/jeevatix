<script lang="ts">
  import { resolve } from '$app/paths';
  import { ArrowRight } from '@lucide/svelte';

  import EventCard from '$lib/components/EventCard.svelte';
  import { cn } from '$lib/utils';

  let { data }: import('./$types').PageProps = $props();
</script>

<svelte:head>
  <title>{data.currentCategory.name} Events | Jeevatix</title>
  <meta
    name="description"
    content={`Daftar event publik kategori ${data.currentCategory.name} di buyer portal Jeevatix.`}
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div
    class="rounded-[2.25rem] border border-white/80 bg-[linear-gradient(135deg,#fff8ef_0%,#eef8ff_100%)] p-7 shadow-[0_26px_80px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <p class="text-muted-foreground text-sm font-semibold tracking-[0.28em] uppercase">
      Category Spotlight
    </p>
    <h1 class="text-foreground mt-3 text-4xl font-semibold tracking-tight">
      {data.currentCategory.name}
    </h1>
    <p class="text-muted-foreground mt-3 max-w-2xl text-base leading-7">
      Menampilkan event publik aktif untuk kategori ini. Gunakan explore page untuk filter yang
      lebih detail berdasarkan kota, tanggal, dan harga.
    </p>
  </div>

  <div class="flex flex-wrap gap-3">
    {#each data.categories as category (category.id)}
      <a
        href={resolve('/categories/[slug]', { slug: category.slug })}
        class={cn(
          'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
          category.slug === data.currentCategory.slug
            ? 'border-foreground bg-foreground text-background'
            : 'border-border bg-card text-foreground hover:border-border hover:text-foreground',
        )}
      >
        {category.name}
      </a>
    {/each}
  </div>

  {#if data.events.length > 0}
    <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {#each data.events as event (event.id)}
        <EventCard {event} compact={true} />
      {/each}
    </div>
  {:else}
    <div class="border-border bg-card/80 rounded-[2rem] border border-dashed p-10 text-center">
      <h2 class="text-foreground text-2xl font-semibold tracking-tight">
        Belum ada event untuk kategori ini
      </h2>
      <p class="text-muted-foreground mt-3 text-sm leading-7">
        Kategori ini belum memiliki event published atau ongoing. Coba kategori lain atau kembali ke
        explore page.
      </p>
      <a
        href={resolve('/events')}
        class="text-foreground hover:text-foreground mt-5 inline-flex items-center gap-2 text-sm font-semibold transition"
      >
        Buka explore page
        <ArrowRight class="size-4" />
      </a>
    </div>
  {/if}
</section>
