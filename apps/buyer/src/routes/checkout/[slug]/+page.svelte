<script lang="ts">
  import { onMount } from 'svelte';
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

  import { Button, Card, Input } from '@jeevatix/ui';

  import type { PublicEventDetail, ReservationCreatePayload } from '$lib/api';
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
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  const availableTiers = $derived(data.event.tiers.filter((tier: EventTier) => tier.remaining > 0));
  const reservation = $derived(form?.reservation ?? null);
  let selectedTierId = $derived(form?.selectedTierId ?? data.defaultTierId ?? availableTiers[0]?.id ?? '');
  const activeTier = $derived(
    data.event.tiers.find((tier: EventTier) => tier.id === selectedTierId) ??
      availableTiers[0] ??
      data.event.tiers[0],
  );
  const maxSelectableQuantity = $derived(
    activeTier ? Math.max(1, Math.min(activeTier.remaining, data.event.max_tickets_per_order)) : 1,
  );
  let quantity = $derived(Math.max(1, Math.min(Number(form?.quantity ?? '1'), maxSelectableQuantity)));

  function decreaseQuantity() {
    quantity = Math.max(1, quantity - 1);
  }

  function increaseQuantity() {
    quantity = Math.min(maxSelectableQuantity, quantity + 1);
  }

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
  <div class="rounded-[2.5rem] border border-white/80 bg-[linear-gradient(135deg,#fff8ef_0%,#fff1e0_44%,#eef9ff_100%)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">Checkout</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Amankan kursi Anda untuk {data.event.title}.
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Pilih tier, tentukan jumlah tiket, lalu lanjutkan ke pembayaran sebelum slot reservasi Anda berakhir.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-[1.5rem] border border-white/70 bg-white/75 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Jadwal Event</p>
          <p class="mt-2 text-sm font-medium leading-6 text-slate-900">
            {formatEventDateRange(data.event.start_at, data.event.end_at)}
          </p>
        </div>
        <div class="rounded-[1.5rem] border border-white/70 bg-white/75 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Lokasi</p>
          <p class="mt-2 text-sm font-medium text-slate-900">{data.event.venue_name}, {data.event.venue_city}</p>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <Card class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Pilih Tiket</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Tentukan tier dan jumlah</h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Maksimal {data.event.max_tickets_per_order} tiket per transaksi. Stok akan dikunci selama 10 menit setelah reservasi berhasil.
          </p>
        </div>

        <div class="flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
          <Ticket class="size-7" />
        </div>
      </div>

      {#if data.event.tiers.length === 0}
        <div class="mt-8 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Tier tiket belum tersedia untuk event ini.
        </div>
      {:else}
        <form class="mt-8 space-y-6" method="POST" action="?/reserve">
          <div class="space-y-4">
            {#each data.event.tiers as tier (tier.id)}
              <label class={`block cursor-pointer rounded-[1.75rem] border p-5 transition ${selectedTierId === tier.id ? 'border-orange-400 bg-orange-50/80 shadow-[0_16px_38px_rgba(249,115,22,0.12)]' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}>
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
                      <h3 class="text-lg font-semibold text-slate-950">{tier.name}</h3>
                      <span class={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase ${tier.remaining > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {tier.remaining > 0 ? 'Available' : 'Sold Out'}
                      </span>
                    </div>
                    {#if tier.description}
                      <p class="mt-2 text-sm leading-6 text-slate-600">{tier.description}</p>
                    {/if}
                  </div>

                  <p class="text-right text-xl font-semibold text-slate-950">{formatCurrency(tier.price)}</p>
                </div>

                <div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                    <ShieldCheck class="size-4 text-emerald-600" />
                    Sisa {tier.remaining} tiket
                  </span>
                  <span class="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5">
                    <CalendarDays class="size-4 text-sky-600" />
                    Penjualan ditutup {formatLongDateTime(tier.sale_end_at ?? data.event.sale_end_at)}
                  </span>
                </div>
              </label>
            {/each}
          </div>

          <div class="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-sm font-medium text-slate-900">Jumlah tiket</p>
                <p class="mt-1 text-sm text-slate-600">
                  Maksimal {maxSelectableQuantity} tiket untuk tier yang dipilih.
                </p>
              </div>

              <div class="flex items-center gap-3">
                  <button type="button" class="flex size-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Kurangi jumlah tiket" onclick={decreaseQuantity} disabled={Boolean(reservation)}>
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
                  <button type="button" class="flex size-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Tambah jumlah tiket" onclick={increaseQuantity} disabled={Boolean(reservation)}>
                  <Plus class="size-4" />
                </button>
              </div>
            </div>
          </div>

          {#if form?.reservationError}
            <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {form.reservationError}
            </div>
          {/if}

          {#if form?.reservationSuccess}
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {form.reservationSuccess}
            </div>
          {/if}

            <Button type="submit" class="w-full rounded-full px-6 py-3" disabled={Boolean(reservation) || !activeTier || activeTier.remaining === 0}>
            Reservasi Tiket
            <MoveRight class="size-4" />
          </Button>

            {#if reservation}
              <p class="text-sm leading-6 text-slate-600">
                Tier dan jumlah tiket dikunci selama reservasi aktif agar ringkasan checkout tetap sesuai dengan slot yang sedang Anda pegang.
              </p>
            {/if}
        </form>
      {/if}
    </Card>

    <div class="space-y-6">
      <Card class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Ringkasan Event</p>
        <div class="mt-5 space-y-4 text-sm text-slate-600">
          <div class="flex items-start gap-3">
            <CalendarDays class="mt-1 size-4 text-orange-600" />
            <div>
              <p class="font-medium text-slate-900">{data.event.title}</p>
              <p class="mt-1 leading-6">{formatEventDateRange(data.event.start_at, data.event.end_at)}</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <MapPinned class="mt-1 size-4 text-sky-600" />
            <div>
              <p class="font-medium text-slate-900">{data.event.venue_name}</p>
              <p class="mt-1 leading-6">{data.event.venue_city}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Reservasi Aktif</p>
            <h2 class="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Status slot Anda</h2>
          </div>
          <div class="flex size-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Clock3 class="size-6" />
          </div>
        </div>

        {#if reservation}
          <div class="mt-5 space-y-5">
            <div class="rounded-[1.75rem] border border-sky-200 bg-sky-50 p-5">
              <p class="text-xs font-semibold tracking-[0.24em] text-sky-700 uppercase">Waktu Tersisa</p>
              <p class="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{formatCountdown(getRemainingMs())}</p>
              <p class="mt-3 text-sm leading-6 text-slate-600">
                Reservasi berakhir pada {formatLongDateTime(reservation.expires_at)}. Lanjutkan ke pembayaran sebelum timer habis.
              </p>
            </div>

            {#if activeTier}
              <div class="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                <p class="text-sm font-medium text-slate-900">Tier dipilih</p>
                <div class="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <p class="text-xl font-semibold text-slate-950">{activeTier.name}</p>
                    <p class="mt-1 text-sm text-slate-600">{quantity} tiket</p>
                  </div>
                  <p class="text-xl font-semibold text-slate-950">{formatCurrency(activeTier.price * quantity)}</p>
                </div>
              </div>
            {/if}

            <form method="POST" action="?/createOrder">
              <input type="hidden" name="reservation_id" value={reservation.reservation_id} />
              <input type="hidden" name="reservation_expires_at" value={reservation.expires_at} />
              <input type="hidden" name="selected_tier_id" value={selectedTierId} />
              <input type="hidden" name="quantity" value={String(quantity)} />
              <Button type="submit" class="w-full rounded-full px-6 py-3" disabled={getRemainingMs() <= 0}>
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
          <div class="mt-5 rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-600">
            Pilih tier tiket lalu buat reservasi untuk memulai countdown checkout Anda.
          </div>
        {/if}

        {#if form?.reservationError && form.reservationError.includes('Tiket habis')}
          <div class="mt-5 flex items-start gap-3 rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            <AlertCircle class="mt-0.5 size-4 shrink-0" />
            <p>Tiket habis untuk tier yang dipilih. Coba pilih tier lain atau kurangi jumlah pembelian.</p>
          </div>
        {/if}
      </Card>
    </div>
  </div>
</section>