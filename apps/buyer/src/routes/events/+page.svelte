<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page as pageStore } from '$app/stores';
  import { Filter, Search, SlidersHorizontal } from '@lucide/svelte';

  import { Button, EmptyState, Input, Select } from '@jeevatix/ui';

  import EventCard from '$lib/components/EventCard.svelte';
  import { cn } from '$lib/utils';

  let { data }: import('./$types').PageProps = $props();

  let searchValue = $state('');
  let priceMinValue = $state(0);
  let priceMaxValue = $state(0);
  let searchTimeout: ReturnType<typeof setTimeout>;

  $effect(() => {
    searchValue = data.filters.search;
    priceMinValue = Number(data.filters.priceMin || 0);
    priceMaxValue = Number(data.filters.priceMax || data.priceBounds.max);
  });

  function buildFilterUrl(overrides: Record<string, string> = {}) {
    const params = new URLSearchParams();
    const current = {
      search: searchValue,
      city: data.filters.city,
      date_from: data.filters.dateFrom,
      date_to: data.filters.dateTo,
      price_min: String(priceMinValue),
      price_max: String(priceMaxValue),
      limit: String(data.filters.limit),
      page: '1',
      ...overrides,
    };
    for (const [key, value] of Object.entries(current)) {
      if (value) params.set(key, value);
    }
    data.filters.categories.forEach((cat) => params.append('category', cat));
    return `${resolve('/events')}?${params.toString()}`;
  }

  function debouncedSearch(value: string) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      goto(buildFilterUrl({ search: value, page: '1' }), { keepFocus: true, noScroll: true });
    }, 500);
  }

  const activeFilterCount = $derived(
    [
      data.filters.search,
      data.filters.city,
      data.filters.dateFrom,
      data.filters.dateTo,
      data.filters.priceMin,
      data.filters.priceMax,
      ...data.filters.categories,
    ].filter(Boolean).length,
  );
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
    class="border-border rounded-[2.25rem] border bg-[var(--gradient-section)] p-7 shadow-[0_26px_80px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.28em] uppercase">
          Explore Events
        </p>
        <h1 class="text-foreground text-4xl font-semibold tracking-tight">
          Temukan event yang paling pas dengan rencana Anda
        </h1>
        <p class="text-muted-foreground max-w-2xl text-base leading-7">
          Gunakan pencarian cepat dan kombinasi filter untuk menyaring event berdasarkan kota,
          kategori, waktu, dan budget.
        </p>
      </div>

      <div
        class="bg-card/80 text-muted-foreground inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
      >
        <SlidersHorizontal class="size-4 text-orange-600" />
        {data.meta.total} event ditemukan
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
    <form
      class="border-border bg-card/90 space-y-6 rounded-[2rem] border p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
      method="GET"
    >
      <div
        class="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-[0.24em] uppercase"
      >
        <Filter class="size-4" />
        Filter Event
        {#if activeFilterCount > 0}
          <span
            class="inline-flex size-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold tracking-normal text-white normal-case"
            >{activeFilterCount}</span
          >
        {/if}
      </div>

      <div class="space-y-3">
        <label class="text-foreground text-sm font-medium" for="search">Search</label>
        <div class="relative">
          <Search
            class="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
          />
          <Input
            id="search"
            name="search"
            placeholder="Cari judul atau keyword event"
            value={searchValue}
            oninput={(e) => {
              searchValue = e.currentTarget.value;
              debouncedSearch(searchValue);
            }}
            class="h-12 rounded-full pl-11"
          />
        </div>
      </div>

      <div class="space-y-3">
        <p class="text-foreground text-sm font-medium">Kategori</p>
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
          <p class="text-muted-foreground text-xs leading-5">
            Multi-select kategori digabungkan dari endpoint kategori publik lalu dipaginasi di
            portal buyer.
          </p>
        {/if}
      </div>

      <div class="space-y-3">
        <label class="text-foreground text-sm font-medium" for="city">Kota</label>
        <Select id="city" name="city" class="h-12 rounded-full">
          <option value="">Semua kota</option>
          {#each data.cityOptions as option (option)}
            <option value={option} selected={data.filters.city === option}>{option}</option>
          {/each}
        </Select>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div class="space-y-3">
          <label class="text-foreground text-sm font-medium" for="date_from">Tanggal mulai</label>
          <Input
            id="date_from"
            name="date_from"
            type="date"
            value={data.filters.dateFrom}
            class="h-12 rounded-2xl"
          />
        </div>
        <div class="space-y-3">
          <label class="text-foreground text-sm font-medium" for="date_to">Tanggal akhir</label>
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
        <p class="text-foreground text-sm font-medium">Rentang harga</p>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div class="space-y-2">
            <div
              class="text-muted-foreground flex items-center justify-between text-xs font-medium"
            >
              <label for="price_min">Minimum</label>
              <span>Rp {priceMinValue.toLocaleString('id-ID')}</span>
            </div>
            <input
              id="price_min"
              class="h-2 w-full cursor-pointer accent-orange-500"
              type="range"
              min={data.priceBounds.min}
              max={data.priceBounds.max}
              step="50000"
              name="price_min"
              value={priceMinValue}
              oninput={(e) => {
                priceMinValue = Number(e.currentTarget.value);
              }}
            />
          </div>
          <div class="space-y-2">
            <div
              class="text-muted-foreground flex items-center justify-between text-xs font-medium"
            >
              <label for="price_max">Maksimum</label>
              <span>Rp {priceMaxValue.toLocaleString('id-ID')}</span>
            </div>
            <input
              id="price_max"
              class="h-2 w-full cursor-pointer accent-sky-500"
              type="range"
              min={data.priceBounds.min}
              max={data.priceBounds.max}
              step="50000"
              name="price_max"
              value={priceMaxValue}
              oninput={(e) => {
                priceMaxValue = Number(e.currentTarget.value);
              }}
            />
          </div>
        </div>
      </div>

      <input type="hidden" name="limit" value={data.filters.limit} />

      <div class="flex gap-3">
        <Button class="flex-1 rounded-full" type="submit">Terapkan Filter</Button>
        <a
          href={resolve('/events')}
          class="border-border text-foreground hover:border-border hover:text-foreground inline-flex flex-1 items-center justify-center rounded-full border px-5 text-sm font-semibold transition"
        >
          Reset
        </a>
      </div>
    </form>

    <div class="space-y-6">
      <div
        class="bg-card/85 flex flex-col gap-3 rounded-[2rem] border border-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-muted-foreground text-sm font-semibold tracking-[0.24em] uppercase">
            Results
          </p>
          <p class="text-foreground mt-2 text-lg font-medium">
            Menampilkan halaman {data.meta.page} dari {Math.max(data.meta.totalPages, 1)}
          </p>
        </div>
        <p class="text-muted-foreground text-sm">
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
        <EmptyState
          title="Tidak ada event yang cocok dengan filter Anda"
          description="Coba ubah kriteria pencarian atau reset filter."
        />
      {/if}

      {#if data.meta.totalPages > 1}
        <div class="flex flex-wrap items-center gap-3">
          {#if data.meta.page > 1}
            <a
              href={buildFilterUrl({ page: String(data.meta.page - 1) })}
              class="border-border bg-card text-foreground hover:bg-muted inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition"
            >
              Halaman Sebelumnya
            </a>
          {/if}

          <div class="flex flex-wrap gap-2">
            {#each Array.from({ length: data.meta.totalPages }, (_, index) => index + 1) as pageNumber (pageNumber)}
              <a
                href={buildFilterUrl({ page: String(pageNumber) })}
                class={cn(
                  'inline-flex size-11 items-center justify-center rounded-full border text-sm font-semibold transition',
                  data.meta.page === pageNumber
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card text-foreground hover:border-border hover:text-foreground',
                )}
              >
                {pageNumber}
              </a>
            {/each}
          </div>

          {#if data.meta.page < data.meta.totalPages}
            <a
              href={buildFilterUrl({ page: String(data.meta.page + 1) })}
              class="border-border bg-card text-foreground hover:bg-muted inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition"
            >
              Halaman Berikutnya
            </a>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</section>
