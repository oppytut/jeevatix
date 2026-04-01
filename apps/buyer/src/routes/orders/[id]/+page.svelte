<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { ArrowLeft, CalendarDays, ReceiptText, Ticket, Wallet } from '@lucide/svelte';

  import { Button, Card } from '@jeevatix/ui';

  import type { OrderDetail } from '$lib/api';
  import { formatCurrency, formatLongDateTime } from '$lib/utils';

  type OrderDetailPageData = {
    order: OrderDetail;
  };

  let { data }: { data: OrderDetailPageData } = $props();

  function getOrderStatusTone(status: OrderDetail['status']) {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-700';
      case 'expired':
        return 'bg-slate-200 text-slate-700';
      case 'cancelled':
        return 'bg-rose-100 text-rose-700';
      case 'refunded':
        return 'bg-sky-100 text-sky-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  }

  function getPaymentStatusTone(status: OrderDetail['payment']['status']) {
    switch (status) {
      case 'success':
        return 'bg-emerald-100 text-emerald-700';
      case 'failed':
        return 'bg-rose-100 text-rose-700';
      case 'refunded':
        return 'bg-sky-100 text-sky-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  }
</script>

<svelte:head>
  <title>{data.order.order_number} | Detail Order Jeevatix</title>
  <meta
    name="description"
    content={`Detail lengkap order ${data.order.order_number} untuk event ${data.order.event_title} di Jeevatix.`}
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div class="flex items-center justify-between gap-4">
    <Button type="button" variant="outline" class="rounded-full px-5" onclick={() => goto(resolve('/orders'))}>
      <ArrowLeft class="size-4" />
      Kembali ke Riwayat Order
    </Button>
  </div>

  <div class="rounded-[2.5rem] border border-white/80 bg-[linear-gradient(135deg,#fff9ef_0%,#f5fbff_52%,#ffffff_100%)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">Order Detail</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          {data.order.order_number}
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Detail transaksi untuk {data.order.event_title}, termasuk item pembelian, status order, dan informasi pembayaran.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Status Order</p>
          <p class={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getOrderStatusTone(data.order.status)}`}>
            {data.order.status}
          </p>
        </div>
        <div class="rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Tanggal Order</p>
          <p class="mt-2 text-sm font-medium text-slate-900">{formatLongDateTime(data.order.created_at)}</p>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <div class="space-y-6">
      <Card class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Order Summary</p>
            <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Ringkasan transaksi</h2>
          </div>
          <div class="flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
            <ReceiptText class="size-7" />
          </div>
        </div>

        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <div class="rounded-[1.5rem] bg-slate-50 p-5">
            <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">Event</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">{data.order.event_title}</p>
            <p class="mt-1 text-sm text-slate-600">Order ID {data.order.id}</p>
          </div>
          <div class="rounded-[1.5rem] bg-slate-50 p-5">
            <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">Batas Bayar</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">{formatLongDateTime(data.order.expires_at)}</p>
            <p class="mt-1 text-sm text-slate-600">
              {data.order.confirmed_at
                ? `Dikonfirmasi ${formatLongDateTime(data.order.confirmed_at)}`
                : 'Menunggu pembayaran atau pembaruan status.'}
            </p>
          </div>
        </div>

        <div class="mt-8 space-y-4">
          {#each data.order.items as item (item.id)}
            <div class="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p class="text-lg font-semibold text-slate-950">{item.tier_name}</p>
                  <p class="mt-1 text-sm text-slate-600">{item.quantity} tiket x {formatCurrency(item.unit_price)}</p>
                </div>
                <p class="text-xl font-semibold text-slate-950">{formatCurrency(item.subtotal)}</p>
              </div>
            </div>
          {/each}
        </div>
      </Card>

      <Card class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Payment Info</p>
            <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Informasi pembayaran</h2>
          </div>
          <div class="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Wallet class="size-7" />
          </div>
        </div>

        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <div class="rounded-[1.5rem] bg-slate-50 p-5">
            <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">Metode</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">{data.order.payment.method}</p>
            <p class="mt-1 text-sm text-slate-600">Payment ID {data.order.payment.id}</p>
          </div>
          <div class="rounded-[1.5rem] bg-slate-50 p-5">
            <p class="text-xs font-semibold tracking-[0.22em] text-slate-500 uppercase">Status Bayar</p>
            <p class={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getPaymentStatusTone(data.order.payment.status)}`}>
              {data.order.payment.status}
            </p>
            <p class="mt-2 text-sm text-slate-600">
              {data.order.payment.paid_at
                ? `Dibayar ${formatLongDateTime(data.order.payment.paid_at)}`
                : 'Belum ada pembayaran yang tercatat.'}
            </p>
          </div>
        </div>
      </Card>
    </div>

    <div class="space-y-6">
      <Card class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Total Pembayaran</p>
        <div class="mt-5 space-y-4">
          <div class="flex items-start gap-3 rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600">
            <CalendarDays class="mt-0.5 size-4 text-orange-600" />
            <div>
              <p class="font-medium text-slate-900">Order dibuat</p>
              <p class="mt-1">{formatLongDateTime(data.order.created_at)}</p>
            </div>
          </div>

          <div class="rounded-[1.5rem] border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(data.order.total_amount - data.order.service_fee)}</span>
            </div>
            <div class="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>Service Fee</span>
              <span>{formatCurrency(data.order.service_fee)}</span>
            </div>
            <div class="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span class="text-base font-medium text-slate-900">Grand Total</span>
              <span class="text-2xl font-semibold text-slate-950">{formatCurrency(data.order.total_amount)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Aksi Berikutnya</p>

        <div class="mt-5 space-y-4">
          {#if data.order.status === 'pending'}
            <Button class="w-full rounded-full px-6 py-3" onclick={() => goto(resolve('/payment/[orderId]', { orderId: data.order.id }))}>
              Bayar Sekarang
              <Wallet class="size-4" />
            </Button>
            <p class="text-sm leading-6 text-slate-600">
              Order masih menunggu pembayaran. Lanjutkan ke halaman payment untuk menyelesaikan transaksi.
            </p>
          {:else if data.order.status === 'confirmed'}
            <Button class="w-full rounded-full px-6 py-3" onclick={() => window.location.assign('/tickets')}>
              Lihat Tiket
              <Ticket class="size-4" />
            </Button>
            <p class="text-sm leading-6 text-slate-600">
              Order sudah terkonfirmasi. Tiket aktif Anda akan tersedia di halaman tiket.
            </p>
          {:else}
            <div class="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              Order ini tidak memerlukan aksi tambahan saat ini. Anda tetap bisa meninjau detail transaksi kapan saja.
            </div>
          {/if}
        </div>
      </Card>
    </div>
  </div>
</section>