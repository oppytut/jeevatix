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
        return 'bg-muted text-foreground';
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
  <nav aria-label="Breadcrumb" class="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
    <a href={resolve('/orders')} class="hover:text-foreground transition">Orders</a>
    <span>/</span>
    <span class="text-foreground font-medium">Detail Order</span>
  </nav>

  <div class="flex items-center justify-between gap-4">
    <Button
      type="button"
      variant="outline"
      class="rounded-full px-5"
      onclick={() => goto(resolve('/orders'))}
    >
      <ArrowLeft class="size-4" />
      Kembali ke Riwayat Order
    </Button>
  </div>

  <div
    class="rounded-[2.5rem] border border-white/80 bg-[var(--gradient-section-alt)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.3em] uppercase">
          Order Detail
        </p>
        <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          {data.order.order_number}
        </h1>
        <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
          Detail transaksi untuk {data.order.event_title}, termasuk item pembelian, status order,
          dan informasi pembayaran.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="bg-card/80 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Status Order
          </p>
          <p
            class={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getOrderStatusTone(data.order.status)}`}
          >
            {data.order.status}
          </p>
        </div>
        <div class="bg-card/80 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Tanggal Order
          </p>
          <p class="text-foreground mt-2 text-sm font-medium">
            {formatLongDateTime(data.order.created_at)}
          </p>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
    <div class="space-y-6">
      <Card
        class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
              Order Summary
            </p>
            <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
              Ringkasan transaksi
            </h2>
          </div>
          <div
            class="flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"
          >
            <ReceiptText class="size-7" />
          </div>
        </div>

        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <div class="bg-muted rounded-[1.5rem] p-5">
            <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
              Event
            </p>
            <p class="text-foreground mt-2 text-lg font-semibold">{data.order.event_title}</p>
            <p class="text-muted-foreground mt-1 text-sm">Order ID {data.order.id}</p>
          </div>
          <div class="bg-muted rounded-[1.5rem] p-5">
            <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
              Batas Bayar
            </p>
            <p class="text-foreground mt-2 text-lg font-semibold">
              {formatLongDateTime(data.order.expires_at)}
            </p>
            <p class="text-muted-foreground mt-1 text-sm">
              {data.order.confirmed_at
                ? `Dikonfirmasi ${formatLongDateTime(data.order.confirmed_at)}`
                : 'Menunggu pembayaran atau pembaruan status.'}
            </p>
          </div>
        </div>

        <div class="mt-8 space-y-4">
          {#each data.order.items as item (item.id)}
            <div class="border-border bg-muted rounded-[1.75rem] border p-5">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p class="text-foreground text-lg font-semibold">{item.tier_name}</p>
                  <p class="text-muted-foreground mt-1 text-sm">
                    {item.quantity} tiket x {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <p class="text-foreground text-xl font-semibold">{formatCurrency(item.subtotal)}</p>
              </div>
            </div>
          {/each}
        </div>
      </Card>

      <Card
        class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
              Payment Info
            </p>
            <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
              Informasi pembayaran
            </h2>
          </div>
          <div class="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <Wallet class="size-7" />
          </div>
        </div>

        <div class="mt-8 grid gap-4 md:grid-cols-2">
          <div class="bg-muted rounded-[1.5rem] p-5">
            <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
              Metode
            </p>
            <p class="text-foreground mt-2 text-lg font-semibold">{data.order.payment.method}</p>
            <p class="text-muted-foreground mt-1 text-sm">Payment ID {data.order.payment.id}</p>
          </div>
          <div class="bg-muted rounded-[1.5rem] p-5">
            <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
              Status Bayar
            </p>
            <p
              class={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getPaymentStatusTone(data.order.payment.status)}`}
            >
              {data.order.payment.status}
            </p>
            <p class="text-muted-foreground mt-2 text-sm">
              {data.order.payment.paid_at
                ? `Dibayar ${formatLongDateTime(data.order.payment.paid_at)}`
                : 'Belum ada pembayaran yang tercatat.'}
            </p>
          </div>
        </div>
      </Card>
    </div>

    <div class="space-y-6">
      <Card
        class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
          Total Pembayaran
        </p>
        <div class="mt-5 space-y-4">
          <div
            class="bg-muted text-muted-foreground flex items-start gap-3 rounded-[1.5rem] p-4 text-sm"
          >
            <CalendarDays class="mt-0.5 size-4 text-orange-600" />
            <div>
              <p class="text-foreground font-medium">Order dibuat</p>
              <p class="mt-1">{formatLongDateTime(data.order.created_at)}</p>
            </div>
          </div>

          <div class="border-border bg-card rounded-[1.5rem] border p-4">
            <div class="text-muted-foreground flex items-center justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(data.order.total_amount - data.order.service_fee)}</span>
            </div>
            <div class="text-muted-foreground mt-3 flex items-center justify-between text-sm">
              <span>Service Fee</span>
              <span>{formatCurrency(data.order.service_fee)}</span>
            </div>
            <div class="border-border mt-4 flex items-center justify-between border-t pt-4">
              <span class="text-foreground text-base font-medium">Grand Total</span>
              <span class="text-foreground text-2xl font-semibold"
                >{formatCurrency(data.order.total_amount)}</span
              >
            </div>
          </div>
        </div>
      </Card>

      <Card
        class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
          Aksi Berikutnya
        </p>

        <div class="mt-5 space-y-4">
          {#if data.order.status === 'pending'}
            <Button
              class="w-full rounded-full px-6 py-3"
              onclick={() => goto(resolve('/payment/[orderId]', { orderId: data.order.id }))}
            >
              Bayar Sekarang
              <Wallet class="size-4" />
            </Button>
            <p class="text-muted-foreground text-sm leading-6">
              Order masih menunggu pembayaran. Lanjutkan ke halaman payment untuk menyelesaikan
              transaksi.
            </p>
          {:else if data.order.status === 'confirmed'}
            <Button class="w-full rounded-full px-6 py-3" onclick={() => goto(resolve('/tickets'))}>
              Lihat Tiket Saya
              <Ticket class="size-4" />
            </Button>
            <p class="text-muted-foreground text-sm leading-6">
              Order sudah terkonfirmasi. Buka halaman tiket untuk menampilkan QR code dan detail
              tiket event Anda.
            </p>
          {:else}
            <div
              class="border-border bg-muted text-muted-foreground rounded-[1.5rem] border border-dashed px-4 py-4 text-sm leading-6"
            >
              Order ini tidak memerlukan aksi tambahan saat ini. Anda tetap bisa meninjau detail
              transaksi kapan saja.
            </div>
          {/if}
        </div>
      </Card>
    </div>
  </div>
</section>
