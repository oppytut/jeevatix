<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { CalendarDays, ChevronLeft, ChevronRight, ReceiptText, Wallet } from '@lucide/svelte';

  import { Button, Card } from '@jeevatix/ui';

  import type { OrderListItem, PaginationMeta } from '$lib/api';
  import { formatCurrency, formatLongDateTime, formatRelativeTime } from '$lib/utils';

  type OrdersPageData = {
    orders: OrderListItem[];
    meta: PaginationMeta;
  };

  let { data }: { data: OrdersPageData } = $props();

  function getStatusTone(status: OrderListItem['status']) {
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

  function goToOrder(orderId: string) {
    void goto(resolve('/orders/[id]', { id: orderId }));
  }

  function goToPage(page: number) {
    if (page < 1 || page > data.meta.totalPages || page === data.meta.page) {
      return;
    }

    void goto(resolve(`/orders?page=${page}`));
  }

  function getVisiblePages() {
    if (data.meta.totalPages <= 1) {
      return [1];
    }

    const start = Math.max(1, data.meta.page - 1);
    const end = Math.min(data.meta.totalPages, start + 2);
    const adjustedStart = Math.max(1, end - 2);

    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }
</script>

<svelte:head>
  <title>Riwayat Order | Jeevatix</title>
  <meta
    name="description"
    content="Lihat semua riwayat order buyer Jeevatix, mulai dari pesanan pending hingga tiket yang sudah terkonfirmasi."
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div
    class="rounded-[2.5rem] border border-white/80 bg-[linear-gradient(135deg,#eef8ff_0%,#fffaf2_48%,#ffffff_100%)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.3em] text-muted-foreground uppercase">Orders</p>
        <h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Semua transaksi Anda dalam satu timeline.
        </h1>
        <p class="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
          Pantau status pembayaran, cek detail pesanan, dan lanjutkan transaksi yang masih pending
          tanpa mencari email konfirmasi.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-[1.5rem] border border-white/70 bg-card/80 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            Total Orders
          </p>
          <p class="mt-2 text-3xl font-semibold text-foreground">{data.meta.total}</p>
        </div>
        <div class="rounded-[1.5rem] border border-white/70 bg-card/80 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            Current Page
          </p>
          <p class="mt-2 text-3xl font-semibold text-foreground">{data.meta.page}</p>
        </div>
      </div>
    </div>
  </div>

  <Card
    class="rounded-[2rem] border border-white/80 bg-card/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm font-semibold tracking-[0.26em] text-muted-foreground uppercase">
          Order History
        </p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Daftar pesanan buyer
        </h2>
      </div>

      <div class="rounded-full bg-muted px-4 py-2 text-sm text-muted-foreground">
        Menampilkan {data.orders.length} dari {data.meta.total} order
      </div>
    </div>

    {#if data.orders.length === 0}
      <div
        class="mt-8 rounded-[1.75rem] border border-dashed border-border bg-muted px-6 py-14 text-center"
      >
        <div
          class="mx-auto flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <ReceiptText class="size-7" />
        </div>
        <h3 class="mt-5 text-2xl font-semibold tracking-tight text-foreground">Belum ada order</h3>
        <p class="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
          Order yang Anda buat dari checkout akan tampil di sini lengkap dengan status pembayaran
          dan detail event.
        </p>
        <Button class="mt-6 rounded-full px-5" onclick={() => goto(resolve('/events'))}
          >Jelajahi Event</Button
        >
      </div>
    {:else}
      <div class="mt-8 space-y-4 lg:hidden">
        {#each data.orders as order (order.id)}
          <button
            type="button"
            class="w-full rounded-[1.75rem] border border-border bg-muted p-5 text-left transition hover:border-border hover:bg-card"
            onclick={() => goToOrder(order.id)}
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-xs font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                  {order.order_number}
                </p>
                <h3 class="mt-2 text-xl font-semibold text-foreground">{order.event_title}</h3>
                <p class="mt-2 text-sm text-muted-foreground">
                  Dibuat {formatRelativeTime(order.created_at)}
                </p>
              </div>
              <span
                class={`rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase ${getStatusTone(order.status)}`}
              >
                {order.status}
              </span>
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <div class="rounded-2xl bg-card px-4 py-3">
                <p class="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                  Tanggal Order
                </p>
                <p class="mt-2 text-sm font-medium text-foreground">
                  {formatLongDateTime(order.created_at)}
                </p>
              </div>
              <div class="rounded-2xl bg-card px-4 py-3">
                <p class="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">Total</p>
                <p class="mt-2 text-sm font-medium text-foreground">
                  {formatCurrency(order.total_amount)}
                </p>
              </div>
            </div>
          </button>
        {/each}
      </div>

      <div class="mt-8 hidden overflow-hidden rounded-[1.75rem] border border-border lg:block">
        <table class="min-w-full divide-y divide-border bg-card">
          <thead class="bg-muted">
            <tr class="text-left text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              <th class="px-6 py-4">Order</th>
              <th class="px-6 py-4">Event</th>
              <th class="px-6 py-4">Tanggal</th>
              <th class="px-6 py-4">Total</th>
              <th class="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            {#each data.orders as order (order.id)}
              <tr>
                <td class="px-6 py-0" colspan="5">
                  <button
                    type="button"
                    class="grid w-full grid-cols-[1.2fr_1.4fr_1fr_1fr_0.9fr] items-center gap-4 py-5 text-left transition hover:bg-muted"
                    onclick={() => goToOrder(order.id)}
                  >
                    <div>
                      <p class="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                        {order.order_number}
                      </p>
                      <p class="mt-2 text-sm text-muted-foreground">
                        Order dibuat {formatRelativeTime(order.created_at)}
                      </p>
                    </div>
                    <div>
                      <p class="font-medium text-foreground">{order.event_title}</p>
                      <p class="mt-1 text-sm text-muted-foreground">
                        Event ID {order.event_id.slice(0, 8)}...
                      </p>
                    </div>
                    <div class="text-sm text-foreground">{formatLongDateTime(order.created_at)}</div>
                    <div class="text-sm font-semibold text-foreground">
                      {formatCurrency(order.total_amount)}
                    </div>
                    <div>
                      <span
                        class={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase ${getStatusTone(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      {#if data.meta.totalPages > 1}
        <div class="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-muted-foreground">
            Halaman {data.meta.page} dari {data.meta.totalPages}
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              class="rounded-full px-4"
              disabled={data.meta.page <= 1}
              onclick={() => goToPage(data.meta.page - 1)}
            >
              <ChevronLeft class="size-4" />
              Sebelumnya
            </Button>

            {#each getVisiblePages() as pageNumber (pageNumber)}
              <button
                type="button"
                class={`flex size-11 items-center justify-center rounded-full border text-sm font-semibold transition ${pageNumber === data.meta.page ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-foreground hover:border-border hover:bg-muted'}`}
                onclick={() => goToPage(pageNumber)}
              >
                {pageNumber}
              </button>
            {/each}

            <Button
              type="button"
              variant="outline"
              class="rounded-full px-4"
              disabled={data.meta.page >= data.meta.totalPages}
              onclick={() => goToPage(data.meta.page + 1)}
            >
              Berikutnya
              <ChevronRight class="size-4" />
            </Button>
          </div>
        </div>
      {/if}
    {/if}
  </Card>

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <Card
      class="rounded-[1.75rem] border border-white/80 bg-card/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex size-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"
        >
          <Wallet class="size-5" />
        </div>
        <div>
          <p class="text-sm font-medium text-foreground">Status pending tetap terlihat</p>
          <p class="mt-1 text-sm leading-6 text-muted-foreground">
            Buka detail order untuk melanjutkan pembayaran sebelum batas waktu habis.
          </p>
        </div>
      </div>
    </Card>

    <Card
      class="rounded-[1.75rem] border border-white/80 bg-card/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"
        >
          <ReceiptText class="size-5" />
        </div>
        <div>
          <p class="text-sm font-medium text-foreground">Order confirmed siap dilacak</p>
          <p class="mt-1 text-sm leading-6 text-muted-foreground">
            Begitu pembayaran sukses, order akan berubah menjadi confirmed dan mengarah ke tiket
            Anda.
          </p>
        </div>
      </div>
    </Card>

    <Card
      class="rounded-[1.75rem] border border-white/80 bg-card/90 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
    >
      <div class="flex items-start gap-3">
        <div class="flex size-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <CalendarDays class="size-5" />
        </div>
        <div>
          <p class="text-sm font-medium text-foreground">Semua timestamp tersimpan</p>
          <p class="mt-1 text-sm leading-6 text-muted-foreground">
            Lihat kapan order dibuat, kapan pembayaran jatuh tempo, dan kapan event Anda
            berlangsung.
          </p>
        </div>
      </div>
    </Card>
  </div>
</section>
