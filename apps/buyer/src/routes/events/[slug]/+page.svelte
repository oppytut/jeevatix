<script lang="ts">
  import { BadgeCheck, CalendarDays, Clock3, MapPinned, MoveRight, Ticket } from '@lucide/svelte';

  import { Button } from '@jeevatix/ui';

  import LiveAvailability from '$lib/components/LiveAvailability.svelte';
  import { formatCurrency, formatEventDateRange, formatLongDateTime } from '$lib/utils';

  let { data }: import('./$types').PageProps = $props();

  function descriptionParagraphs(text: string | null) {
    if (!text) {
      return ['Deskripsi event belum ditambahkan oleh penyelenggara.'];
    }

    return text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);
  }

  function getMapUrl() {
    if (data.event.venue_latitude === null || data.event.venue_longitude === null) {
      return null;
    }

    return `https://www.openstreetmap.org/export/embed.html?bbox=${data.event.venue_longitude - 0.01}%2C${data.event.venue_latitude - 0.01}%2C${data.event.venue_longitude + 0.01}%2C${data.event.venue_latitude + 0.01}&layer=mapnik&marker=${data.event.venue_latitude}%2C${data.event.venue_longitude}`;
  }
</script>

<svelte:head>
  <title>{data.event.title} | Jeevatix</title>
  <meta
    name="description"
    content={data.event.description ?? `Detail event ${data.event.title} di Jeevatix.`}
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div
    class="overflow-hidden rounded-[2.5rem] border border-white/80 bg-white/85 shadow-[0_28px_90px_rgba(15,23,42,0.08)]"
  >
    <div
      class="relative aspect-16/8 overflow-hidden bg-[linear-gradient(135deg,#f97316,#facc15_45%,#0ea5e9)]"
    >
      {#if data.event.banner_url}
        <img
          src={data.event.banner_url}
          alt={data.event.title}
          class="h-full w-full object-cover"
        />
      {/if}
      <div
        class="absolute inset-0 bg-linear-to-t from-slate-950/75 via-slate-950/10 to-transparent"
      ></div>

      <div class="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8 lg:p-10">
        <div class="flex flex-wrap gap-2">
          {#each data.event.categories as category}
            <a
              href={`/categories/${category.slug}`}
              class="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.22em] uppercase backdrop-blur"
            >
              {category.name}
            </a>
          {/each}
        </div>
        <h1 class="mt-4 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {data.event.title}
        </h1>
        <div class="mt-5 flex flex-wrap gap-3 text-sm text-white/85">
          <span
            class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur"
          >
            <CalendarDays class="size-4" />
            {formatEventDateRange(data.event.start_at, data.event.end_at)}
          </span>
          <span
            class="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur"
          >
            <MapPinned class="size-4" />
            {data.event.venue_city}
          </span>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <div class="space-y-6">
      {#if data.event.images.length > 0}
        <section
          class="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
                Gallery
              </p>
              <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Preview suasana event
              </h2>
            </div>
          </div>
          <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {#each data.event.images as image}
              <div class="overflow-hidden rounded-[1.5rem] bg-slate-100">
                <img
                  src={image.image_url}
                  alt={data.event.title}
                  class="aspect-4/3 h-full w-full object-cover"
                />
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <section
        class="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6"
      >
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
          Tentang Event
        </p>
        <div class="mt-4 space-y-4 text-base leading-8 text-slate-700">
          {#each descriptionParagraphs(data.event.description) as paragraph}
            <p>{paragraph}</p>
          {/each}
        </div>
      </section>

      <section
        class="rounded-[2rem] border border-white/80 bg-white/90 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6"
      >
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
          Lokasi & Jadwal
        </p>
        <div class="mt-5 grid gap-5 lg:grid-cols-2">
          <div class="space-y-4 rounded-[1.5rem] bg-slate-50 p-5">
            <div class="flex items-start gap-3">
              <CalendarDays class="mt-1 size-5 text-orange-600" />
              <div>
                <h3 class="text-lg font-semibold text-slate-950">Waktu Event</h3>
                <p class="mt-2 text-sm leading-7 text-slate-600">
                  {formatEventDateRange(data.event.start_at, data.event.end_at)}
                </p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <Clock3 class="mt-1 size-5 text-sky-600" />
              <div>
                <h3 class="text-lg font-semibold text-slate-950">Penjualan Tiket</h3>
                <p class="mt-2 text-sm leading-7 text-slate-600">
                  Dimulai {formatLongDateTime(data.event.sale_start_at)} dan ditutup {formatLongDateTime(
                    data.event.sale_end_at,
                  )}.
                </p>
              </div>
            </div>
          </div>

          <div class="space-y-4 rounded-[1.5rem] bg-slate-50 p-5">
            <div class="flex items-start gap-3">
              <MapPinned class="mt-1 size-5 text-emerald-600" />
              <div>
                <h3 class="text-lg font-semibold text-slate-950">Lokasi Venue</h3>
                <p class="mt-2 text-sm leading-7 text-slate-600">
                  {data.event.venue_name}<br />
                  {data.event.venue_address ?? 'Alamat venue akan diumumkan penyelenggara.'}<br />
                  {data.event.venue_city}
                </p>
              </div>
            </div>
          </div>
        </div>

        {#if getMapUrl()}
          <div class="mt-5 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100">
            <iframe title="Lokasi event" src={getMapUrl()} class="h-80 w-full border-0"></iframe>
          </div>
        {/if}
      </section>
    </div>

    <aside class="space-y-6">
      <section
        class="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
              Ticket Tiers
            </p>
            <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Pilih tier yang paling cocok
            </h2>
          </div>
          <div class="rounded-2xl bg-orange-100 p-3 text-orange-700">
            <Ticket class="size-5" />
          </div>
        </div>

        <div class="mt-5 space-y-4">
          <LiveAvailability
            eventId={data.event.id}
            initialTiers={data.event.tiers.map((tier) => ({
              tierId: tier.id,
              name: tier.name,
              quota: tier.quota,
              remaining: tier.remaining,
            }))}
          />

          {#each data.event.tiers as tier}
            <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-lg font-semibold text-slate-950">{tier.name}</h3>
                  {#if tier.description}
                    <p class="mt-1 text-sm leading-6 text-slate-600">{tier.description}</p>
                  {/if}
                </div>
                <span
                  class="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-slate-700 uppercase"
                >
                  Tier Detail
                </span>
              </div>

              <div class="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">
                    Harga
                  </p>
                  <p class="mt-1 text-xl font-semibold text-slate-950">
                    {formatCurrency(tier.price)}
                  </p>
                </div>
                <div class="text-right text-sm text-slate-600">
                  <p>Kuota {tier.quota} tiket</p>
                  <p>{tier.sold_count} tiket sudah terjual</p>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <a href={`/checkout/${data.event.slug}`} class="mt-5 block">
          <Button class="w-full rounded-full px-5 py-3">
            Beli Tiket
            <MoveRight class="size-4" />
          </Button>
        </a>
        <p class="mt-3 text-center text-xs leading-5 text-slate-500">
          Maksimal {data.event.max_tickets_per_order} tiket per order untuk event ini.
        </p>
      </section>

      <section
        class="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6"
      >
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
          Penyelenggara
        </p>
        <div class="mt-5 flex items-start gap-4">
          <div
            class="flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-semibold text-slate-700"
          >
            {#if data.event.seller.logo_url}
              <img
                src={data.event.seller.logo_url}
                alt={data.event.seller.org_name}
                class="h-full w-full object-cover"
              />
            {:else}
              {data.event.seller.org_name.slice(0, 1)}
            {/if}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-xl font-semibold text-slate-950">{data.event.seller.org_name}</h2>
              {#if data.event.seller.is_verified}
                <BadgeCheck class="size-5 text-emerald-600" />
              {/if}
            </div>
            <p class="mt-2 text-sm leading-7 text-slate-600">
              {data.event.seller.org_description ??
                'Penyelenggara belum menambahkan deskripsi organisasi.'}
            </p>
          </div>
        </div>
      </section>
    </aside>
  </div>
</section>
