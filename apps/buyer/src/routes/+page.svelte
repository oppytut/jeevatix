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

  import { Button } from '@jeevatix/ui';

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

<section class="relative overflow-hidden py-6 sm:py-8 lg:py-10">
  <div class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
    <div
      class="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-[linear-gradient(135deg,#fff7ed_0%,#fff1d6_30%,#e0f2fe_100%)] p-8 shadow-[0_30px_90px_rgba(15,23,42,0.10)] sm:p-10 lg:p-12"
    >
      <div
        class="absolute inset-0 opacity-70"
        style="background-image:
        radial-gradient(circle at 15% 20%, rgba(249,115,22,0.18), transparent 30%),
        radial-gradient(circle at 85% 15%, rgba(14,165,233,0.22), transparent 28%),
        radial-gradient(circle at 50% 100%, rgba(250,204,21,0.22), transparent 35%);"
      ></div>

      <div class="relative space-y-8">
        <div
          class="inline-flex w-fit items-center gap-3 rounded-full border border-orange-200/70 bg-white/70 px-4 py-2 text-sm font-semibold tracking-[0.26em] text-orange-700 uppercase backdrop-blur"
        >
          <Sparkles class="size-4" />
          Event Discovery Layer
        </div>

        <div class="space-y-5">
          <h1
            class="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl"
          >
            Panggung, tribun, workshop, dan festival terbaik kini ada dalam satu alur pencarian.
          </h1>
          <p class="max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
            Temukan event yang relevan lebih cepat, bandingkan tier tiket, lalu lanjutkan ke
            pembelian tanpa ribet saat momen favoritmu sudah tayang.
          </p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row">
          <a href={resolve('/events')}>
            <Button class="h-12 rounded-full px-6 text-sm font-semibold">
              Jelajah Event
              <ArrowRight class="size-4" />
            </Button>
          </a>
          <a
            href="#featured"
            class="inline-flex h-12 items-center justify-center rounded-full border border-white/80 bg-white/70 px-6 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Lihat Highlight Minggu Ini
          </a>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div class="rounded-[1.5rem] border border-white/70 bg-white/75 p-4 backdrop-blur">
            <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Featured</p>
            <p class="mt-3 text-3xl font-semibold text-slate-950">
              {formatCompactNumber(data.featuredEvents.length)}
            </p>
            <p class="mt-2 text-sm text-slate-600">Kurasi event dengan momentum paling tinggi.</p>
          </div>
          <div class="rounded-[1.5rem] border border-white/70 bg-white/75 p-4 backdrop-blur">
            <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Kategori</p>
            <p class="mt-3 text-3xl font-semibold text-slate-950">
              {formatCompactNumber(data.categories.length)}
            </p>
            <p class="mt-2 text-sm text-slate-600">
              Jalur cepat untuk menemukan vibe yang kamu cari.
            </p>
          </div>
          <div class="rounded-[1.5rem] border border-white/70 bg-white/75 p-4 backdrop-blur">
            <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Upcoming</p>
            <p class="mt-3 text-3xl font-semibold text-slate-950">
              {formatCompactNumber(data.upcomingMeta.total)}
            </p>
            <p class="mt-2 text-sm text-slate-600">
              Agenda terdekat yang siap diburu sebelum sold out.
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
      <div
        class="rounded-[2rem] border border-white/80 bg-white/85 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur sm:p-7"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex size-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"
          >
            <CalendarRange class="size-6" />
          </div>
          <div>
            <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">
              Agenda Cerdas
            </p>
            <h2 class="text-lg font-semibold text-slate-950">
              Rencanakan weekend tanpa tebak-tebakan
            </h2>
          </div>
        </div>
        <p class="mt-4 text-sm leading-7 text-slate-600">
          Filter by kota, rentang tanggal, dan harga untuk menyaring event yang benar-benar relevan
          dengan waktu dan budget Anda.
        </p>
      </div>

      <div
        class="rounded-[2rem] border border-white/80 bg-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:p-7"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex size-12 items-center justify-center rounded-2xl bg-white/10 text-amber-300"
          >
            <MapPin class="size-6" />
          </div>
          <div>
            <p class="text-xs font-semibold tracking-[0.24em] text-white/60 uppercase">
              Kota Populer
            </p>
            <h2 class="text-lg font-semibold">Jakarta, Bandung, Surabaya, Yogyakarta</h2>
          </div>
        </div>
        <p class="mt-4 text-sm leading-7 text-white/72">
          Temukan event di kota-kota dengan jadwal paling padat dan lineup paling cepat berubah.
        </p>
        <a
          href={resolve('/events')}
          class="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-300"
        >
          Mulai eksplor sekarang
          <ArrowRight class="size-4" />
        </a>
      </div>
    </div>
  </div>
</section>

<section id="featured" class="py-8 sm:py-10">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
        Featured Events
      </p>
      <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        Highlight yang sedang ramai dibicarakan
      </h2>
    </div>
    <a
      href={resolve('/events')}
      class="text-sm font-semibold text-slate-700 transition hover:text-slate-950"
      >Lihat semua event</a
    >
  </div>

  <div class="mt-6 grid gap-5 lg:grid-cols-3">
    {#if data.featuredEvents.length > 0}
      {#each data.featuredEvents.slice(0, 3) as event (event.id)}
        <EventCard {event} />
      {/each}
    {:else}
      <div
        class="rounded-[2rem] border border-dashed border-slate-200 bg-white/70 p-10 text-center text-slate-500 lg:col-span-3"
      >
        Event featured belum tersedia.
      </div>
    {/if}
  </div>
</section>

<section class="py-8 sm:py-10">
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
        Browse by Category
      </p>
      <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        Mulai dari kategori yang paling cocok dengan mood Anda
      </h2>
    </div>
    <div class="inline-flex items-center gap-2 text-sm text-slate-500">
      <Ticket class="size-4" />
      Update mengikuti event yang sudah published dan ongoing.
    </div>
  </div>

  <div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {#each data.categories as category (category.id)}
      <a
        href={resolve('/categories/[slug]', { slug: category.slug })}
        class="group rounded-[1.75rem] border border-white/80 bg-white/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.12)]"
      >
        <div
          class={`inline-flex size-12 items-center justify-center rounded-2xl bg-linear-to-br ${categoryAccentMap[category.slug] ?? 'from-slate-700 to-slate-400'} text-white`}
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
          <h3 class="text-xl font-semibold tracking-tight text-slate-950">{category.name}</h3>
          <p class="text-sm leading-6 text-slate-600">
            {category.event_count} event publik siap dijelajahi pada kategori ini.
          </p>
        </div>
        <div
          class="mt-5 flex items-center justify-between text-sm font-semibold text-slate-600 transition group-hover:text-slate-950"
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
      <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Upcoming Picks</p>
      <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        Agenda terdekat yang layak diamankan dari sekarang
      </h2>
    </div>
    <a
      href={resolve('/events')}
      class="text-sm font-semibold text-slate-700 transition hover:text-slate-950"
      >Buka halaman explore</a
    >
  </div>

  <div class="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
    {#if data.upcomingEvents.length > 0}
      {#each data.upcomingEvents as event (event.id)}
        <EventCard {event} compact={true} />
      {/each}
    {:else}
      <div
        class="rounded-[2rem] border border-dashed border-slate-200 bg-white/70 p-10 text-center text-slate-500 md:col-span-2 xl:col-span-4"
      >
        Belum ada event upcoming yang bisa ditampilkan.
      </div>
    {/if}
  </div>
</section>
