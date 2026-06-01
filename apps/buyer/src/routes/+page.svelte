<script lang="ts">
  import { resolve } from '$app/paths';
  import {
    ArrowRight,
    CalendarRange,
    Dumbbell,
    FerrisWheel,
    MapPin,
    MicVocal,
    Music2,
    Sparkles,
    Ticket,
    Wrench,
  } from '@lucide/svelte';

  import { Button, EmptyState } from '@jeevatix/ui';

  import EventCard from '$lib/components/EventCard.svelte';
  import { formatCompactNumber } from '$lib/utils';

  let { data }: import('./$types').PageProps = $props();

  const categoryAccentMap: Record<string, string> = {
    musik: 'from-orange-500 to-amber-300',
    olahraga: 'from-emerald-500 to-lime-300',
    workshop: 'from-sky-500 to-cyan-300',
    konser: 'from-rose-500 to-pink-300',
    festival: 'from-violet-500 to-fuchsia-300',
  };

  const categoryIconMap = {
    musik: Music2,
    olahraga: Dumbbell,
    workshop: Wrench,
    konser: MicVocal,
    festival: FerrisWheel,
  };
</script>

<svelte:head>
  <title>Jeevatix | Temukan Event Favoritmu</title>
  <meta
    name="description"
    content="Jelajahi event unggulan, kategori populer, dan agenda terdekat di buyer portal Jeevatix."
  />
</svelte:head>

<section class="relative overflow-hidden py-8 sm:py-12 lg:py-16">
  <div class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
    <div
      class="border-border relative overflow-hidden rounded-[var(--radius-panel)] border bg-[var(--gradient-section)] p-10 shadow-[var(--shadow-spotlight)] sm:p-12 lg:p-16"
    >
      <div
        class="absolute inset-0 opacity-60"
        style="background-image: var(--gradient-overlay-top);"
      ></div>

      <div class="relative space-y-10">
        <div
          class="bg-card/60 inline-flex w-fit items-center gap-2.5 rounded-full border border-orange-200/60 px-5 py-2.5 text-xs font-bold tracking-[0.28em] text-orange-700 uppercase shadow-sm backdrop-blur-md"
        >
          <Sparkles class="size-4" />
          Event Discovery Layer
        </div>

        <div class="space-y-6">
          <h1
            class="text-foreground max-w-3xl text-5xl leading-[1.1] font-bold tracking-tight sm:text-6xl lg:text-7xl"
          >
            Temukan event yang
            <span class="bg-[var(--gradient-brand)] bg-clip-text text-transparent">
              menggerakkan hatimu
            </span>
          </h1>
          <p class="text-muted-foreground max-w-2xl text-lg leading-relaxed sm:text-xl">
            Panggung, tribun, workshop, festival — semua dalam satu pencarian. Bandingkan tiket,
            amankan kursi, tanpa ribet.
          </p>
        </div>

        <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
          <a href={resolve('/events')} class="group">
            <Button
              class="bg-jeevatix-600 hover:bg-jeevatix-700 dark:bg-jeevatix-500 dark:hover:bg-jeevatix-600 px-8 py-4 text-base text-white"
            >
              Jelajah Event Sekarang
              <ArrowRight class="size-5 transition-transform group-hover:translate-x-1" />
            </Button>
          </a>
          <a
            href="#featured"
            class="border-foreground bg-background text-foreground hover:bg-muted inline-flex items-center justify-center gap-2 rounded-2xl border px-7 py-4 text-base font-semibold shadow-[var(--shadow-edit)] transition-[transform,box-shadow] duration-150 hover:-translate-y-[2px] hover:shadow-[var(--shadow-edit-lifted)] active:translate-y-0 active:shadow-[var(--shadow-edit)]"
          >
            Lihat Highlight Minggu Ini
          </a>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div
            class="border-border bg-card/70 group rounded-[var(--radius-card)] border p-5 backdrop-blur-md transition-all hover:scale-[1.02] hover:shadow-lg"
          >
            <p class="text-muted-foreground text-[0.7rem] font-bold tracking-[0.22em] uppercase">
              Featured
            </p>
            <p class="text-foreground mt-2.5 text-4xl font-bold">
              {formatCompactNumber(data.featuredEvents.length)}
            </p>
            <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
              Event dengan momentum tertinggi
            </p>
          </div>
          <div
            class="border-border bg-card/70 group rounded-[var(--radius-card)] border p-5 backdrop-blur-md transition-all hover:scale-[1.02] hover:shadow-lg"
          >
            <p class="text-muted-foreground text-[0.7rem] font-bold tracking-[0.22em] uppercase">
              Kategori
            </p>
            <p class="text-foreground mt-2.5 text-4xl font-bold">
              {formatCompactNumber(data.categories.length)}
            </p>
            <p class="text-muted-foreground mt-2 text-sm leading-relaxed">Jalur cepat ke vibe-mu</p>
          </div>
          <div
            class="border-border bg-card/70 group rounded-[var(--radius-card)] border p-5 backdrop-blur-md transition-all hover:scale-[1.02] hover:shadow-lg"
          >
            <p class="text-muted-foreground text-[0.7rem] font-bold tracking-[0.22em] uppercase">
              Upcoming
            </p>
            <p class="text-foreground mt-2.5 text-4xl font-bold">
              {formatCompactNumber(data.upcomingMeta.total)}
            </p>
            <p class="text-muted-foreground mt-2 text-sm leading-relaxed">Agenda siap diburu</p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
      <div
        class="border-border bg-card/90 group rounded-[var(--radius-panel)] border p-7 shadow-[var(--shadow-spotlight)] backdrop-blur-md transition-all hover:scale-[1.02] hover:shadow-xl sm:p-8"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-slate-900 shadow-lg dark:text-white"
          >
            <CalendarRange class="size-7" />
          </div>
          <div>
            <p class="text-muted-foreground text-[0.7rem] font-bold tracking-[0.22em] uppercase">
              Agenda Cerdas
            </p>
            <h2 class="text-foreground mt-1 text-xl leading-tight font-bold">
              Rencanakan weekend tanpa tebak-tebakan
            </h2>
          </div>
        </div>
        <p class="text-muted-foreground mt-5 text-sm leading-relaxed">
          Filter kota, tanggal, dan harga untuk menyaring event yang benar-benar relevan dengan
          waktu dan budget-mu.
        </p>
      </div>

      <div
        class="bg-foreground text-background group relative overflow-hidden rounded-[var(--radius-panel)] border border-white/20 p-7 shadow-[0_28px_80px_rgba(15,23,42,0.20)] transition-all hover:scale-[1.02] hover:shadow-2xl sm:p-8"
      >
        <div
          class="absolute inset-0 opacity-20"
          style="background: radial-gradient(circle at 80% 20%, rgba(251,191,36,0.4), transparent 50%);"
        ></div>
        <div class="relative">
          <div class="flex items-start gap-4">
            <div
              class="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-400 text-slate-900 shadow-lg"
            >
              <MapPin class="size-7" />
            </div>
            <div>
              <p class="text-[0.7rem] font-bold tracking-[0.22em] text-white/70 uppercase">
                Kota Populer
              </p>
              <h2 class="mt-1 text-xl leading-tight font-bold">
                Jakarta, Bandung, Surabaya, Yogya
              </h2>
            </div>
          </div>
          <p class="mt-5 text-sm leading-relaxed text-white/75">
            Temukan event di kota dengan jadwal terpadat dan lineup paling dinamis.
          </p>
          <a
            href={resolve('/events')}
            class="mt-6 inline-flex items-center gap-2 text-sm font-bold text-amber-300 transition-all hover:gap-3"
          >
            Mulai eksplor sekarang
            <ArrowRight class="size-4" />
          </a>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="featured" class="py-8 sm:py-10">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
        Featured Events
      </p>
      <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
        Highlight yang sedang ramai dibicarakan
      </h2>
    </div>
    <a
      href={resolve('/events')}
      class="text-foreground hover:text-foreground text-sm font-semibold transition"
      >Lihat semua event</a
    >
  </div>

  <div class="mt-6 grid gap-5 lg:grid-cols-3">
    {#if data.featuredEvents.length > 0}
      {#each data.featuredEvents.slice(0, 3) as event (event.id)}
        <EventCard {event} />
      {/each}
    {:else}
      <div class="lg:col-span-3">
        <EmptyState title="Event featured belum tersedia" />
      </div>
    {/if}
  </div>
</section>

<section class="py-8 sm:py-10">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
        Browse by Category
      </p>
      <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
        Mulai dari kategori yang paling cocok dengan mood Anda
      </h2>
    </div>
    <div class="text-muted-foreground inline-flex items-center gap-2 text-sm">
      <Ticket class="size-4" />
      Update mengikuti event yang sudah published dan ongoing.
    </div>
  </div>

  <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.categories as category (category.id)}
      <a
        href={resolve('/categories/[slug]', { slug: category.slug })}
        class="group border-border bg-card/85 rounded-[1.75rem] border p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.12)]"
      >
        <div
          class={`inline-flex size-12 items-center justify-center rounded-2xl bg-linear-to-br ${categoryAccentMap[category.slug] ?? 'from-muted to-muted-foreground'} text-white`}
        >
          {#if category.slug === 'musik'}
            <Music2 class="size-6" />
          {:else if category.slug === 'olahraga'}
            <Dumbbell class="size-6" />
          {:else if category.slug === 'workshop'}
            <Wrench class="size-6" />
          {:else if category.slug === 'konser'}
            <MicVocal class="size-6" />
          {:else if category.slug === 'festival'}
            <FerrisWheel class="size-6" />
          {:else}
            <Ticket class="size-6" />
          {/if}
        </div>
        <div class="mt-5 space-y-2">
          <h3 class="text-foreground text-xl font-semibold tracking-tight">{category.name}</h3>
          <p class="text-muted-foreground text-sm leading-6">
            {category.event_count} event publik siap dijelajahi pada kategori ini.
          </p>
        </div>
        <div
          class="text-muted-foreground group-hover:text-foreground mt-5 flex items-center justify-between text-sm font-semibold transition"
        >
          <span>Lihat kategori</span>
          <ArrowRight class="size-4" />
        </div>
      </a>
    {/each}
  </div>
</section>

<section class="py-8 sm:py-10">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
        Upcoming Picks
      </p>
      <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
        Agenda terdekat yang layak diamankan dari sekarang
      </h2>
    </div>
    <a
      href={resolve('/events')}
      class="text-foreground hover:text-foreground text-sm font-semibold transition"
      >Buka halaman explore</a
    >
  </div>

  <div class="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
    {#if data.upcomingEvents.length > 0}
      {#each data.upcomingEvents as event (event.id)}
        <EventCard {event} compact={true} />
      {/each}
    {:else}
      <div class="md:col-span-2 xl:col-span-4">
        <EmptyState title="Belum ada event upcoming yang bisa ditampilkan" />
      </div>
    {/if}
  </div>
</section>
