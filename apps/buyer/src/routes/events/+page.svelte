<script lang="ts">
  import { resolve } from '$app/paths';
  import { Filter, Search, SlidersHorizontal } from '@lucide/svelte';

  import { Button, Input } from '@jeevatix/ui';

  import EventCard from '$lib/components/EventCard.svelte';
  import { cn } from '$lib/utils';

  let { data }: import('./$types').PageProps = $props();
</script>

<svelte:head>
  <title>Semua Event — Jeevatix</title>
  <meta
    name="description"
    content="Jelajahi semua event yang tersedia di Jeevatix. Musik, festival, workshop, seminar, dan lainnya."
  />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Semua Event — Jeevatix" />
  <meta
    property="og:description"
    content="Jelajahi semua event yang tersedia di Jeevatix. Musik, festival, workshop, seminar, dan lainnya."
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div
    class="rounded-[2.25rem] border border-border bg-[linear-gradient(135deg,#fff8ef_0%,#eef8ff_100%)] p-7 shadow-[0_26px_80px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.28em] text-muted-foreground uppercase">
          Explore Events
        </p>
        <h1 class="text-4xl font-semibold tracking-tight text-foreground">
          Temukan event yang paling pas dengan rencana Anda
        </h1>
        <p class="max-w-2xl text-base leading-7 text-muted-foreground">
          Gunakan pencarian cepat dan kombinasi filter untuk menyaring event berdasarkan kota,
          kategori, waktu, dan budget.
        </p>
      </div>

      <div
        class="inline-flex items-center gap-2 rounded-full bg-card/80 px-4 py-2 text-sm font-medium text-muted-foreground"
      >
        <SlidersHorizontal class="size-4 text-orange-600" />
        {data.meta.total} event ditemukan
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
    <form
      class="space-y-6 rounded-[2rem] border border-border bg-card/90 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
      method="GET"
    >
      <div
        class="flex items-center gap-2 text-sm font-semibold tracking-[0.24em] text-muted-foreground uppercase"
      >
        <Filter class="size-4" />
        Filter Event
      </div>

      <div class="space-y-3">
        <label class="text-sm font-medium text-foreground" for="search">Search</label>
        <div class="relative">
          <Search
            class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="search"
            name="search"
            placeholder="Cari judul atau keyword event"
            value={data.filters.search}
            class="h-12 rounded-full pl-11"
          />
        </div>
      </div>

      <div class="space-y-3">
        <p class="text-sm font-medium text-foreground">Kategori</p>
        <div class="flex flex-wrap gap-2">
          {#each data.categories as category (category.id)}
            <label
              class={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition',
                data.filters.categories.includes(category.slug)
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-muted text-foreground hover:border-border',
              )}
            >
              <input
                class="sr-only"
                type="checkbox"
                name="category"
                value={category.slug}
                checked={data.filters.categories.includes(category.slug)}
              />
              <span>{category.name}</span>
            </label>
          {/each}
        </div>
        {#if data.filters.categories.length > 1}
          <p class="text-xs leading-5 text-muted-foreground">
            Multi-select kategori digabungkan dari endpoint kategori publik lalu dipaginasi di
            portal buyer.
          </p>
        {/if}
      </div>

      <div class="space-y-3">
        <label class="text-sm font-medium text-foreground" for="city">Kota</label>
        <select
          id="city"
          name="city"
          class="h-12 w-full rounded-2xl border border-border bg-card px-4 text-sm text-foreground transition outline-none focus:border-foreground"
        >
          <option value="">Semua kota</option>
          {#each data.cityOptions as option (option)}
            <option value={option} selected={data.filters.city === option}>{option}</option>
          {/each}
        </select>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div class="space-y-3">
          <label class="text-sm font-medium text-foreground" for="date_from">Tanggal mulai</label>
          <Input
            id="date_from"
            name="date_from"
            type="date"
            value={data.filters.dateFrom}
            class="h-12 rounded-2xl"
          />
        </div>
        <div class="space-y-3">
          <label class="text-sm font-medium text-foreground" for="date_to">Tanggal akhir</label>
          <Input
            id="date_to"
            name="date_to"
            type="date"
            value={data.filters.dateTo}
            class="h-12 rounded-2xl"
          />
        </div>
      </div>

      <div class="space-y-4">
        <p class="text-sm font-medium text-foreground">Rentang harga</p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <label for="price_min">Minimum</label>
              <span>Rp {Number(data.filters.priceMin || 0).toLocaleString('id-ID')}</span>
            </div>
            <input
              id="price_min"
              class="h-2 w-full cursor-pointer accent-orange-500"
              type="range"
              min={data.priceBounds.min}
              max={data.priceBounds.max}
              step="50000"
              name="price_min"
              value={data.filters.priceMin || 0}
            />
          </div>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <label for="price_max">Maksimum</label>
              <span
                >Rp {Number(data.filters.priceMax || data.priceBounds.max).toLocaleString(
                  'id-ID',
                )}</span
              >
            </div>
            <input
              id="price_max"
              class="h-2 w-full cursor-pointer accent-sky-500"
              type="range"
              min={data.priceBounds.min}
              max={data.priceBounds.max}
              step="50000"
              name="price_max"
              value={data.filters.priceMax || data.priceBounds.max}
            />
          </div>
        </div>
      </div>

      <input type="hidden" name="limit" value={data.filters.limit} />

      <div class="flex gap-3">
        <Button class="flex-1 rounded-full" type="submit">Terapkan Filter</Button>
        <a
          href={resolve('/events')}
          class="inline-flex flex-1 items-center justify-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition hover:border-border hover:text-foreground"
        >
          Reset
        </a>
      </div>
    </form>

    <div class="space-y-6">
      <div
        class="flex flex-col gap-3 rounded-[2rem] border border-white/80 bg-card/85 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-sm font-semibold tracking-[0.24em] text-muted-foreground uppercase">Results</p>
          <p class="mt-2 text-lg font-medium text-foreground">
            Menampilkan halaman {data.meta.page} dari {Math.max(data.meta.totalPages, 1)}
          </p>
        </div>
        <p class="text-sm text-muted-foreground">
          {data.meta.total} event publik cocok dengan filter saat ini.
        </p>
      </div>

      {#if data.events.length > 0}
        <div class="grid gap-5 xl:grid-cols-2">
          {#each data.events as event (event.id)}
            <EventCard {event} compact={true} />
          {/each}
        </div>
      {:else}
        <div
          class="rounded-[2rem] border border-dashed border-border bg-card/70 p-10 text-center text-muted-foreground"
        >
          Tidak ada event yang cocok dengan filter Anda. Coba ubah kriteria pencarian atau reset
          filter.
        </div>
      {/if}

      {#if data.meta.totalPages > 1}
        <div class="flex flex-wrap items-center gap-3">
          {#if data.meta.page > 1}
            <form method="GET">
              <input type="hidden" name="search" value={data.filters.search} />
              <input type="hidden" name="city" value={data.filters.city} />
              <input type="hidden" name="date_from" value={data.filters.dateFrom} />
              <input type="hidden" name="date_to" value={data.filters.dateTo} />
              <input type="hidden" name="price_min" value={data.filters.priceMin} />
              <input type="hidden" name="price_max" value={data.filters.priceMax} />
              <input type="hidden" name="limit" value={data.filters.limit} />
              {#each data.filters.categories as category (category)}
                <input type="hidden" name="category" value={category} />
              {/each}
              <button
                type="submit"
                name="page"
                value={data.meta.page - 1}
                class="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
              >
                Halaman Sebelumnya
              </button>
            </form>
          {/if}

          <div class="flex flex-wrap gap-2">
            {#each Array.from({ length: data.meta.totalPages }, (_, index) => index + 1) as pageNumber (pageNumber)}
              <form method="GET">
                <input type="hidden" name="search" value={data.filters.search} />
                <input type="hidden" name="city" value={data.filters.city} />
                <input type="hidden" name="date_from" value={data.filters.dateFrom} />
                <input type="hidden" name="date_to" value={data.filters.dateTo} />
                <input type="hidden" name="price_min" value={data.filters.priceMin} />
                <input type="hidden" name="price_max" value={data.filters.priceMax} />
                <input type="hidden" name="limit" value={data.filters.limit} />
                {#each data.filters.categories as category (category)}
                  <input type="hidden" name="category" value={category} />
                {/each}
                <button
                  type="submit"
                  name="page"
                  value={pageNumber}
                  class={cn(
                    'inline-flex size-11 items-center justify-center rounded-full border text-sm font-semibold transition',
                    data.meta.page === pageNumber
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {pageNumber}
                </button>
              </form>
            {/each}
          </div>

          {#if data.meta.page < data.meta.totalPages}
            <form method="GET">
              <input type="hidden" name="search" value={data.filters.search} />
              <input type="hidden" name="city" value={data.filters.city} />
              <input type="hidden" name="date_from" value={data.filters.dateFrom} />
              <input type="hidden" name="date_to" value={data.filters.dateTo} />
              <input type="hidden" name="price_min" value={data.filters.priceMin} />
              <input type="hidden" name="price_max" value={data.filters.priceMax} />
              <input type="hidden" name="limit" value={data.filters.limit} />
              {#each data.filters.categories as category (category)}
                <input type="hidden" name="category" value={category} />
              {/each}
              <button
                type="submit"
                name="page"
                value={data.meta.page + 1}
                class="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground"
              >
                Halaman Berikutnya
              </button>
            </form>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>
