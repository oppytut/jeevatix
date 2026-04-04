<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { ArrowLeft, Download, MapPin, QrCode, Ticket, TicketCheck } from '@lucide/svelte';
  import QRCode from 'qrcode';

  import { Button, Card } from '@jeevatix/ui';

  import type { BuyerTicketDetail } from '$lib/api';
  import { formatEventDateRange, formatLongDateTime } from '$lib/utils';

  type TicketDetailPageData = {
    ticket: BuyerTicketDetail;
  };

  let { data }: { data: TicketDetailPageData } = $props();

  let qrImageUrl = $state('');
  let qrError = $state('');

  function getStatusTone(status: BuyerTicketDetail['status']) {
    switch (status) {
      case 'used':
        return 'bg-slate-200 text-slate-700';
      case 'cancelled':
        return 'bg-rose-100 text-rose-700';
      case 'refunded':
        return 'bg-sky-100 text-sky-700';
      default:
        return 'bg-emerald-100 text-emerald-700';
    }
  }

  async function renderQrCode() {
    if (!browser) {
      return;
    }

    try {
      qrImageUrl = await QRCode.toDataURL(data.ticket.qr_data, {
        width: 640,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
      qrError = '';
    } catch {
      qrImageUrl = '';
      qrError = 'QR code tiket tidak bisa dirender saat ini.';
    }
  }

  async function downloadQrCode() {
    if (!browser) {
      return;
    }

    if (!qrImageUrl) {
      await renderQrCode();
    }

    if (!qrImageUrl) {
      return;
    }

    const link = document.createElement('a');
    link.href = qrImageUrl;
    link.download = `${data.ticket.ticket_code}.png`;
    document.body.append(link);
    link.click();
    link.remove();
  }

  $effect(() => {
    void renderQrCode();
  });
</script>

<svelte:head>
  <title>{data.ticket.ticket_code} | Tiket Jeevatix</title>
  <meta
    name="description"
    content={`Detail tiket ${data.ticket.ticket_code} untuk event ${data.ticket.event.title} di Jeevatix.`}
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div class="flex items-center justify-between gap-4">
    <Button
      type="button"
      variant="outline"
      class="rounded-full px-5"
      onclick={() => goto(resolve('/tickets'))}
    >
      <ArrowLeft class="size-4" />
      Kembali ke Tiket Saya
    </Button>
  </div>

  <div
    class="rounded-[2.5rem] border border-white/80 bg-[linear-gradient(135deg,#eef8ff_0%,#ffffff_48%,#f4fff7_100%)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">Ticket Detail</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          {data.ticket.event.title}
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Simpan QR code ini untuk proses check-in di venue. Detail event dan kode tiket sudah
          tersinkron dengan transaksi Anda.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Status</p>
          <p
            class={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusTone(data.ticket.status)}`}
          >
            {data.ticket.status}
          </p>
        </div>
        <div class="rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Tier</p>
          <p class="mt-2 text-lg font-semibold text-slate-950">{data.ticket.tier_name}</p>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
    <div class="space-y-6">
      <Card
        class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
              Event Info
            </p>
            <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Informasi event
            </h2>
          </div>
          <div class="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Ticket class="size-7" />
          </div>
        </div>

        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <div class="rounded-[1.5rem] bg-slate-50 p-5">
            <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">
              Tanggal Event
            </p>
            <p class="mt-2 text-lg font-semibold text-slate-950">
              {formatEventDateRange(data.ticket.event.start_at, data.ticket.event.end_at)}
            </p>
          </div>
          <div class="rounded-[1.5rem] bg-slate-50 p-5">
            <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">Venue</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">{data.ticket.event.venue_name}</p>
            <p class="mt-1 text-sm text-slate-600">{data.ticket.event.venue_city}</p>
          </div>
        </div>

        <div class="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <div class="flex items-start gap-3 text-sm text-slate-600">
            <MapPin class="mt-0.5 size-4 text-orange-700" />
            <div>
              <p class="font-medium text-slate-900">Lokasi lengkap</p>
              <p class="mt-1">
                {data.ticket.event.venue_address ??
                  `${data.ticket.event.venue_name}, ${data.ticket.event.venue_city}`}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-6 grid gap-4 md:grid-cols-2">
          <div class="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">Order</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">{data.ticket.order_number}</p>
            <p class="mt-1 text-sm text-slate-600">
              Diterbitkan {formatLongDateTime(data.ticket.issued_at)}
            </p>
          </div>
          <div class="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">
              Ticket Code
            </p>
            <p
              class="mt-2 font-mono text-lg font-semibold tracking-[0.18em] break-all text-slate-950"
            >
              {data.ticket.ticket_code}
            </p>
          </div>
        </div>

        {#if data.ticket.status === 'used' && data.ticket.checked_in_at}
          <div
            class="mt-6 flex items-start gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600"
          >
            <TicketCheck class="mt-0.5 size-4 text-slate-700" />
            <div>
              <p class="font-medium text-slate-900">Tiket sudah digunakan</p>
              <p class="mt-1">
                Check-in tercatat pada {formatLongDateTime(data.ticket.checked_in_at)}.
              </p>
            </div>
          </div>
        {/if}
      </Card>
    </div>

    <Card
      class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">QR Access</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Scan-ready QR code
          </h2>
        </div>
        <div
          class="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"
        >
          <QrCode class="size-7" />
        </div>
      </div>

      <div
        class="mt-8 rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-center"
      >
        {#if qrImageUrl}
          <img
            src={qrImageUrl}
            alt={`QR code untuk tiket ${data.ticket.ticket_code}`}
            class="mx-auto w-full max-w-[320px] rounded-[1.5rem] bg-white p-4 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
          />
        {:else}
          <div
            class="mx-auto flex h-[320px] w-full max-w-[320px] items-center justify-center rounded-[1.5rem] bg-white p-6 text-sm text-slate-500 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
          >
            {qrError || 'Menyiapkan QR code tiket...'}
          </div>
        {/if}
      </div>

      <div class="mt-6 space-y-4">
        <Button class="w-full rounded-full px-6 py-3" onclick={downloadQrCode}>
          Download QR
          <Download class="size-4" />
        </Button>

        <div class="rounded-[1.5rem] bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Tunjukkan QR code ini kepada petugas saat check-in. Pastikan layar cukup terang atau
          gunakan file PNG hasil unduhan.
        </div>
      </div>
    </Card>
  </div>
</section>
