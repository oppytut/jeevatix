<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import {
    AlertCircle,
    CalendarDays,
    Clock3,
    MapPinned,
    Minus,
    MoveRight,
    Plus,
    ShieldCheck,
    Ticket,
    Trash2,
  } from '@lucide/svelte';

  import { Button, Card, Input, Modal } from '@jeevatix/ui';

  import type { PublicEventDetail, ReservationCreatePayload } from '$lib/api';
  import LiveAvailability, {
    type LiveAvailabilityTier,
  } from '$lib/components/LiveAvailability.svelte';
  import { formatCurrency, formatEventDateRange, formatLongDateTime } from '$lib/utils';

  type EventTier = PublicEventDetail['tiers'][number];
  type CheckoutData = {
    event: PublicEventDetail;
    defaultTierId: string | null;
  };
  type CheckoutForm = {
    reservation?: ReservationCreatePayload | null;
    reservationError?: string;
    reservationSuccess?: string;
    selectedTierId?: string;
    quantity?: string;
  };

  let { data, form }: { data: CheckoutData; form?: CheckoutForm } = $props();

  let now = $state(Date.now());
  let liveTiers = $state<EventTier[]>([]);
  let liveTiersInitialized = $state(false);
  let formStateInitialized = $state(false);
  let showSoldOutModal = $state(false);
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  const availableTiers = $derived(liveTiers.filter((tier: EventTier) => tier.remaining > 0));
  const reservation = $derived(form?.reservation ?? null);
  let selectedTierId = $state('');
  const activeTier = $derived(
    liveTiers.find((tier: EventTier) => tier.id === selectedTierId) ??
      availableTiers[0] ??
      liveTiers[0],
  );
  const maxSelectableQuantity = $derived(
    activeTier ? Math.max(1, Math.min(activeTier.remaining, data.event.max_tickets_per_order)) : 1,
  );
  let quantity = $state(1);

  function getInitialSelectedTierId() {
    return (
      form?.selectedTierId ??
      data.defaultTierId ??
      data.event.tiers.find((tier) => tier.remaining > 0)?.id ??
      data.event.tiers[0]?.id ??
      ''
    );
  }

  function getInitialQuantity() {
    const parsedQuantity = Number(form?.quantity ?? '1');

    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
      return 1;
    }

    return Math.min(parsedQuantity, data.event.max_tickets_per_order);
  }

  function decreaseQuantity() {
    quantity = Math.max(1, quantity - 1);
  }

  function increaseQuantity() {
    quantity = Math.min(maxSelectableQuantity, quantity + 1);
  }

  function handleAvailabilityChange(nextTiers: LiveAvailabilityTier[]) {
    const remainingByTierId = new Map(nextTiers.map((tier) => [tier.tierId, tier.remaining]));

    liveTiers = liveTiers.map((tier) => ({
      ...tier,
      remaining: remainingByTierId.has(tier.id)
        ? (remainingByTierId.get(tier.id) ?? tier.remaining)
        : tier.remaining,
    }));
  }

  $effect(() => {
    if (liveTiersInitialized) {
      return;
    }

    liveTiers = data.event.tiers.map((tier) => ({ ...tier }));
    liveTiersInitialized = true;
  });

  $effect(() => {
    if (formStateInitialized || !liveTiersInitialized) {
      return;
    }

    selectedTierId = getInitialSelectedTierId();
    quantity = getInitialQuantity();
    formStateInitialized = true;
  });

  $effect(() => {
    if (!reservation && activeTier?.remaining === 0) {
      showSoldOutModal = true;
      return;
    }

    if (activeTier?.remaining !== 0) {
      showSoldOutModal = false;
    }
  });

  function getRemainingMs() {
    if (!reservation?.expires_at) {
      return 0;
    }

    return new Date(reservation.expires_at).getTime() - now;
  }

  function formatCountdown(ms: number) {
    const safeMs = Math.max(0, ms);
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');

    return `${minutes}:${seconds}`;
  }

  onMount(() => {
    countdownInterval = setInterval(() => {
      now = Date.now();
    }, 1000);

    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  });
</script>

<svelte:head>
  <title>Checkout {data.event.title} | Jeevatix</title>
  <meta
    name="description"
    content={`Reservasi tiket untuk ${data.event.title} dan lanjutkan ke pembayaran di Jeevatix.`}
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <nav aria-label="Breadcrumb" class="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
    <a href={resolve('/events')} class="hover:text-foreground transition">Events</a>
    <span>/</span>
    <span class="text-foreground font-medium">Checkout</span>
  </nav>

  <Modal
    open={showSoldOutModal}
    title="Tiket habis"
    description="Tiket habis, reservasi Anda mungkin tidak berhasil. Pilih tier lain atau kembali lagi nanti."
    onClose={() => {
      showSoldOutModal = false;
    }}
  />

  <div
    class="rounded-[2.5rem] border border-white/80 bg-[var(--gradient-section-alt)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.3em] uppercase">
          Checkout
        </p>
        <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Amankan kursi Anda untuk {data.event.title}.
        </h1>
        <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
          Pilih tier, tentukan jumlah tiket, lalu lanjutkan ke pembayaran sebelum slot reservasi
          Anda berakhir.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="bg-card/75 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Jadwal Event
          </p>
          <p class="text-foreground mt-2 text-sm leading-6 font-medium">
            {formatEventDateRange(data.event.start_at, data.event.end_at)}
          </p>
        </div>
        <div class="bg-card/75 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Lokasi
          </p>
          <p class="text-foreground mt-2 text-sm font-medium">
            {data.event.venue_name}, {data.event.venue_city}
          </p>
        </div>
      </div>
    </div>
  </div>

  <LiveAvailability
    eventId={data.event.id}
    initialTiers={liveTiers.map((tier) => ({
      tierId: tier.id,
      name: tier.name,
      quota: tier.quota,
      remaining: tier.remaining,
    }))}
    onAvailabilityChange={handleAvailabilityChange}
  />

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <Card
      class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
            Pilih Tiket
          </p>
          <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
            Tentukan tier dan jumlah
          </h2>
          <p class="text-muted-foreground mt-2 text-sm leading-6">
            Maksimal {data.event.max_tickets_per_order} tiket per transaksi. Stok akan dikunci selama
            10 menit setelah reservasi berhasil.
          </p>
        </div>

        <div
          class="flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"
        >
          <Ticket class="size-7" />
        </div>
      </div>

      {#if data.event.tiers.length === 0}
        <div
          class="mt-8 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800"
        >
          Tier tiket belum tersedia untuk event ini.
        </div>
      {:else}
        <form class="mt-8 space-y-6" method="POST" action="?/reserve">
          <div class="space-y-4">
            {#each liveTiers as tier (tier.id)}
              <label
                class={`block cursor-pointer rounded-[1.75rem] border p-5 transition ${selectedTierId === tier.id ? 'border-orange-400 bg-orange-50/80 shadow-[0_16px_38px_rgba(249,115,22,0.12)]' : 'border-border bg-muted hover:border-border hover:bg-card'}`}
              >
                <input
                  class="sr-only"
                  type="radio"
                  name="ticket_tier_id"
                  value={tier.id}
                  bind:group={selectedTierId}
                  checked={selectedTierId === tier.id}
                  disabled={Boolean(reservation) || tier.remaining === 0}
                />

                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="flex items-center gap-3">
                      <h3 class="text-foreground text-lg font-semibold">{tier.name}</h3>
                      <span
                        class={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase ${tier.remaining > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}
                      >
                        {tier.remaining > 0 ? 'Available' : 'Sold Out'}
                      </span>
                    </div>
                    {#if tier.description}
                      <p class="text-muted-foreground mt-2 text-sm leading-6">{tier.description}</p>
                    {/if}
                  </div>

                  <p class="text-foreground text-right text-xl font-semibold">
                    {formatCurrency(tier.price)}
                  </p>
                </div>

                <div class="text-muted-foreground mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span class="bg-card inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                    <ShieldCheck class="size-4 text-emerald-600" />
                    Sisa {tier.remaining} tiket
                  </span>
                  <span class="bg-card inline-flex items-center gap-2 rounded-full px-3 py-1.5">
                    <CalendarDays class="size-4 text-sky-600" />
                    Penjualan ditutup {formatLongDateTime(
                      tier.sale_end_at ?? data.event.sale_end_at,
                    )}
                  </span>
                </div>
              </label>
            {/each}
          </div>

          <div class="border-border bg-muted rounded-[1.75rem] border p-5">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-foreground text-sm font-medium">Jumlah tiket</p>
                <p class="text-muted-foreground mt-1 text-sm">
                  Maksimal {maxSelectableQuantity} tiket untuk tier yang dipilih.
                </p>
              </div>

              <div class="flex items-center gap-3">
                <button
                  type="button"
                  class="border-border bg-card text-muted-foreground flex size-10 items-center justify-center rounded-full border disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Kurangi jumlah tiket"
                  onclick={decreaseQuantity}
                  disabled={Boolean(reservation)}
                >
                  <Minus class="size-4" />
                </button>
                <Input
                  name="quantity"
                  type="number"
                  min="1"
                  max={String(maxSelectableQuantity)}
                  bind:value={quantity}
                  class="w-20 text-center"
                  disabled={Boolean(reservation)}
                />
                <button
                  type="button"
                  class="border-border bg-card text-muted-foreground flex size-10 items-center justify-center rounded-full border disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Tambah jumlah tiket"
                  onclick={increaseQuantity}
                  disabled={Boolean(reservation)}
                >
                  <Plus class="size-4" />
                </button>
              </div>
            </div>
          </div>

          {#if form?.reservationError}
            <div
              class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {form.reservationError}
            </div>
          {/if}

          {#if form?.reservationSuccess}
            <div
              class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              {form.reservationSuccess}
            </div>
          {/if}

          <Button
            type="submit"
            class="w-full rounded-full px-6 py-3"
            disabled={Boolean(reservation) || !activeTier || activeTier.remaining === 0}
          >
            Reservasi Tiket
            <MoveRight class="size-4" />
          </Button>

          {#if reservation}
            <p class="text-muted-foreground text-sm leading-6">
              Tier dan jumlah tiket dikunci selama reservasi aktif agar ringkasan checkout tetap
              sesuai dengan slot yang sedang Anda pegang.
            </p>
          {/if}
        </form>
      {/if}
    </Card>

    <div class="space-y-6">
      <Card
        class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
          Ringkasan Event
        </p>
        <div class="text-muted-foreground mt-5 space-y-4 text-sm">
          <div class="flex items-start gap-3">
            <CalendarDays class="mt-1 size-4 text-orange-600" />
            <div>
              <p class="text-foreground font-medium">{data.event.title}</p>
              <p class="mt-1 leading-6">
                {formatEventDateRange(data.event.start_at, data.event.end_at)}
              </p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <MapPinned class="mt-1 size-4 text-sky-600" />
            <div>
              <p class="text-foreground font-medium">{data.event.venue_name}</p>
              <p class="mt-1 leading-6">{data.event.venue_city}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card
        class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
              Reservasi Aktif
            </p>
            <h2 class="text-foreground mt-2 text-2xl font-semibold tracking-tight">
              Status slot Anda
            </h2>
          </div>
          <div class="flex size-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Clock3 class="size-6" />
          </div>
        </div>

        {#if reservation}
          <div class="mt-5 space-y-5">
            <div class="rounded-[1.75rem] border border-sky-200 bg-sky-50 p-5">
              <p class="text-xs font-semibold tracking-[0.24em] text-sky-700 uppercase">
                Waktu Tersisa
              </p>
              <p class="text-foreground mt-3 text-4xl font-semibold tracking-tight">
                {formatCountdown(getRemainingMs())}
              </p>
              <p class="text-muted-foreground mt-3 text-sm leading-6">
                Reservasi berakhir pada {formatLongDateTime(reservation.expires_at)}. Lanjutkan ke
                pembayaran sebelum timer habis.
              </p>
            </div>

            {#if activeTier}
              <div class="border-border bg-muted rounded-[1.75rem] border p-5">
                <p class="text-foreground text-sm font-medium">Tier dipilih</p>
                <div class="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <p class="text-foreground text-xl font-semibold">{activeTier.name}</p>
                    <p class="text-muted-foreground mt-1 text-sm">{quantity} tiket</p>
                  </div>
                  <p class="text-foreground text-xl font-semibold">
                    {formatCurrency(activeTier.price * quantity)}
                  </p>
                </div>
              </div>
            {/if}

            <form method="POST" action="?/createOrder">
              <input type="hidden" name="reservation_id" value={reservation.reservation_id} />
              <input type="hidden" name="reservation_expires_at" value={reservation.expires_at} />
              <input type="hidden" name="selected_tier_id" value={selectedTierId} />
              <input type="hidden" name="quantity" value={String(quantity)} />
              <Button
                type="submit"
                class="w-full rounded-full px-6 py-3"
                disabled={getRemainingMs() <= 0}
              >
                Lanjut ke Pembayaran
                <MoveRight class="size-4" />
              </Button>
            </form>

            <form method="POST" action="?/cancelReservation">
              <input type="hidden" name="reservation_id" value={reservation.reservation_id} />
              <input type="hidden" name="selected_tier_id" value={selectedTierId} />
              <input type="hidden" name="quantity" value={String(quantity)} />
              <Button type="submit" variant="outline" class="w-full rounded-full px-6 py-3">
                Batalkan Reservasi
                <Trash2 class="size-4" />
              </Button>
            </form>
          </div>
        {:else}
          <div
            class="border-border bg-muted text-muted-foreground mt-5 rounded-[1.75rem] border border-dashed px-5 py-6 text-sm leading-7"
          >
            Pilih tier tiket lalu buat reservasi untuk memulai countdown checkout Anda.
          </div>
        {/if}

        {#if form?.reservationError && form.reservationError.includes('Tiket habis')}
          <div
            class="mt-5 flex items-start gap-3 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700"
          >
            <AlertCircle class="mt-0.5 size-4 shrink-0" />
            <p>
              Tiket habis untuk tier yang dipilih. Coba pilih tier lain atau kurangi jumlah
              pembelian.
            </p>
          </div>
        {/if}
      </Card>
    </div>
  </div>
</section>
