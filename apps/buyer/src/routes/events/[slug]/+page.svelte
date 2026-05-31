<script lang="ts">
  import { resolve } from '$app/paths';
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

  const jsonLdScript = $derived(
    `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: data.event.title,
      description: data.event.description ?? undefined,
      startDate: data.event.start_at,
      endDate: data.event.end_at,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: {
        '@type': 'Place',
        name: data.event.venue_name,
        address: {
          '@type': 'PostalAddress',
          addressLocality: data.event.venue_city,
          streetAddress: data.event.venue_address ?? undefined,
        },
        ...(data.event.venue_latitude && data.event.venue_longitude
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: data.event.venue_latitude,
                longitude: data.event.venue_longitude,
              },
            }
          : {}),
      },
      image: data.event.banner_url ?? 'https://jeevatix.my.id/og-default.png',
      organizer: {
        '@type': 'Organization',
        name: data.event.seller.org_name,
        ...(data.event.seller.logo_url ? { logo: data.event.seller.logo_url } : {}),
      },
      ...(data.event.min_price != null
        ? {
            offers: {
              '@type': 'Offer',
              price: data.event.min_price,
              priceCurrency: 'IDR',
              availability: 'https://schema.org/InStock',
              url: `https://jeevatix.my.id/events/${data.event.slug}`,
              validFrom: data.event.sale_start_at,
            },
          }
        : {}),
    })}<\/script>`,
  );
</script>

<svelte:head>
  <title>{data.event.title} | Jeevatix</title>
  <meta
    name="description"
    content={data.event.description?.slice(0, 160) ??
      `Detail event ${data.event.title} di Jeevatix.`}
  />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={`${data.event.title} | Jeevatix`} />
  <meta
    property="og:description"
    content={data.event.description?.slice(0, 160) ??
      `Detail event ${data.event.title} di Jeevatix.`}
  />
  <meta
    property="og:image"
    content={data.event.banner_url ?? 'https://jeevatix.my.id/og-default.png'}
  />
  <!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON.stringify output is safe for JSON-LD ld+json script injection -->
  {@html jsonLdScript}
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <nav aria-label="Breadcrumb" class="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
    <a href={resolve('/events')} class="hover:text-foreground transition">Events</a>
    <span>/</span>
    <span class="text-foreground font-medium">{data.event.title}</span>
  </nav>

  <div
    class="bg-card/85 overflow-hidden rounded-[2.5rem] border border-white/80 shadow-[0_28px_90px_rgba(15,23,42,0.08)]"
  >
    <div class="relative aspect-16/8 overflow-hidden bg-[var(--gradient-hero)]">
      {#if data.event.banner_url}
        <img
          src={data.event.banner_url}
          alt={data.event.title}
          width="1600"
          height="800"
          fetchpriority="high"
          decoding="async"
          class="h-full w-full object-cover"
        />
      {/if}
      <div
        class="absolute inset-0 bg-linear-to-t from-foreground/75 via-foreground/10 to-transparent"
      ></div>

      <div class="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8 lg:p-10">
        <div class="flex flex-wrap gap-2">
          {#each data.event.categories as category (category.id)}
            <a
              href={resolve('/categories/[slug]', { slug: category.slug })}
              class="bg-card/10 rounded-full border border-white/25 px-3 py-1 text-xs font-semibold tracking-[0.22em] uppercase backdrop-blur"
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
            class="bg-card/10 inline-flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur"
          >
            <CalendarDays class="size-4" />
            {formatEventDateRange(data.event.start_at, data.event.end_at)}
          </span>
          <span
            class="bg-card/10 inline-flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur"
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
          class="bg-card/90 rounded-[2rem] border border-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6"
        >
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
                Gallery
              </p>
              <h2 class="text-foreground mt-2 text-2xl font-semibold tracking-tight">
                Preview suasana event
              </h2>
            </div>
          </div>
          <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {#each data.event.images as image (image.id)}
              <div class="bg-muted overflow-hidden rounded-[1.5rem]">
                <img
                  src={image.image_url}
                  alt={data.event.title}
                  width="600"
                  height="450"
                  loading="lazy"
                  decoding="async"
                  class="aspect-4/3 h-full w-full object-cover"
                />
              </div>
            {/each}
          </div>
        </section>
      {/if}

      <section
        class="bg-card/90 rounded-[2rem] border border-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6"
      >
        <h2 class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
          Tentang Event
        </h2>
        <div class="text-foreground mt-4 space-y-4 text-base leading-8">
          {#each descriptionParagraphs(data.event.description) as paragraph (paragraph)}
            <p>{paragraph}</p>
          {/each}
        </div>
      </section>

      <section
        class="bg-card/90 rounded-[2rem] border border-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6"
      >
        <h2 class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
          Lokasi & Jadwal
        </h2>
        <div class="mt-5 grid gap-5 lg:grid-cols-2">
          <div class="bg-muted space-y-4 rounded-[1.5rem] p-5">
            <div class="flex items-start gap-3">
              <CalendarDays class="mt-1 size-5 text-orange-600" />
              <div>
                <h3 class="text-foreground text-lg font-semibold">Waktu Event</h3>
                <p class="text-muted-foreground mt-2 text-sm leading-7">
                  {formatEventDateRange(data.event.start_at, data.event.end_at)}
                </p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <Clock3 class="mt-1 size-5 text-sky-600" />
              <div>
                <h3 class="text-foreground text-lg font-semibold">Penjualan Tiket</h3>
                <p class="text-muted-foreground mt-2 text-sm leading-7">
                  Dimulai {formatLongDateTime(data.event.sale_start_at)} dan ditutup {formatLongDateTime(
                    data.event.sale_end_at,
                  )}.
                </p>
              </div>
            </div>
          </div>

          <div class="bg-muted space-y-4 rounded-[1.5rem] p-5">
            <div class="flex items-start gap-3">
              <MapPinned class="mt-1 size-5 text-emerald-600" />
              <div>
                <h3 class="text-foreground text-lg font-semibold">Lokasi Venue</h3>
                <p class="text-muted-foreground mt-2 text-sm leading-7">
                  {data.event.venue_name}<br />
                  {data.event.venue_address ?? 'Alamat venue akan diumumkan penyelenggara.'}<br />
                  {data.event.venue_city}
                </p>
              </div>
            </div>
          </div>
        </div>

        {#if getMapUrl()}
          <div class="border-border bg-muted mt-5 overflow-hidden rounded-[1.5rem] border">
            <iframe title="Lokasi event" src={getMapUrl()} class="h-80 w-full border-0"></iframe>
          </div>
        {/if}
      </section>
    </div>

    <div class="space-y-6" role="region" aria-label="Informasi tiket dan penyelenggara">
      <section
        class="bg-card/92 rounded-[2rem] border border-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
              Ticket Tiers
            </p>
            <h2 class="text-foreground mt-2 text-2xl font-semibold tracking-tight">
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

          {#each data.event.tiers as tier (tier.id)}
            <div class="border-border bg-muted rounded-[1.5rem] border p-4">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-foreground text-lg font-semibold">{tier.name}</h3>
                  {#if tier.description}
                    <p class="text-muted-foreground mt-1 text-sm leading-6">{tier.description}</p>
                  {/if}
                </div>
                <span
                  class="bg-muted text-foreground rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase"
                >
                  Tier Detail
                </span>
              </div>

              <div class="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p
                    class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase"
                  >
                    Harga
                  </p>
                  <p class="text-foreground mt-1 text-xl font-semibold">
                    {formatCurrency(tier.price)}
                  </p>
                </div>
                <div class="text-muted-foreground text-right text-sm">
                  <p>Kuota {tier.quota} tiket</p>
                  <p>{tier.sold_count} tiket sudah terjual</p>
                </div>
              </div>
            </div>
          {/each}
        </div>

        {#if data.event.tiers.every((t) => t.sold_count >= t.quota)}
          <div class="border-border bg-muted mt-5 rounded-2xl border p-4 text-center">
            <p class="text-muted-foreground text-sm font-semibold">
              Semua tier sudah habis terjual
            </p>
          </div>
        {:else}
          <a href={resolve('/checkout/[slug]', { slug: data.event.slug })} class="mt-5 block">
            <Button class="w-full rounded-full px-5 py-3">
              Beli Tiket
              <MoveRight class="size-4" />
            </Button>
          </a>
          <p class="text-muted-foreground mt-3 text-center text-xs leading-5">
            Maksimal {data.event.max_tickets_per_order} tiket per order untuk event ini.
          </p>
        {/if}
      </section>

      <section
        class="bg-card/92 rounded-[2rem] border border-white/80 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6"
      >
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
          Penyelenggara
        </p>
        <div class="mt-5 flex items-start gap-4">
          <div
            class="bg-muted text-foreground flex size-16 items-center justify-center overflow-hidden rounded-2xl text-lg font-semibold"
          >
            {#if data.event.seller.logo_url}
              <img
                src={data.event.seller.logo_url}
                alt={data.event.seller.org_name}
                width="64"
                height="64"
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover"
              />
            {:else}
              {data.event.seller.org_name.slice(0, 1)}
            {/if}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-foreground text-xl font-semibold">{data.event.seller.org_name}</h2>
              {#if data.event.seller.is_verified}
                <BadgeCheck class="size-5 text-emerald-600" />
              {/if}
            </div>
            <p class="text-muted-foreground mt-2 text-sm leading-7">
              {data.event.seller.org_description ??
                'Penyelenggara belum menambahkan deskripsi organisasi.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>
</section>
