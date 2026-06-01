<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { CalendarDays, ChevronLeft, ChevronRight, ReceiptText, Wallet, X } from '@lucide/svelte';

  import { Button, Card, EmptyState, Select, StatusBadge } from '@jeevatix/ui';

  import type { OrderListItem, PaginationMeta } from '$lib/api';
  import { formatCurrency, formatLongDateTime, formatRelativeTime } from '$lib/utils';

  type OrdersPageData = {
    orders: OrderListItem[];
    meta: PaginationMeta;
    filters: {
      status: string;
    };
  };

  let { data }: { data: OrdersPageData } = $props();

  function getStatusVariant(status: OrderListItem['status']) {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'expired':
        return 'neutral';
      case 'cancelled':
        return 'error';
      case 'refunded':
        return 'info';
      default:
        return 'warning';
    }
  }

  function goToOrder(orderId: string) {
    void goto(resolve('/orders/[id]', { id: orderId }));
  }

  function buildOrdersQuery(overrides: Record<string, string> = {}) {
    const params = new URLSearchParams();
    const current = {
      status: data.filters.status,
      page: String(data.meta.page),
      ...overrides,
    };

    for (const [key, value] of Object.entries(current)) {
      if (value && value !== 'all') {
        params.set(key, value);
      }
    }

    return params.toString();
  }

  function goToPage(page: number) {
    if (page < 1 || page > data.meta.totalPages || page === data.meta.page) {
      return;
    }

    const query = buildOrdersQuery({ page: String(page) });
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() is invoked inside the conditional expression
    void goto(query ? `${resolve('/orders')}?${query}` : resolve('/orders'));
  }

  function handleStatusChange(event: Event) {
    const target = event.currentTarget as HTMLSelectElement;
    const query = buildOrdersQuery({ status: target.value, page: '1' });
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() is invoked inside the conditional expression
    void goto(query ? `${resolve('/orders')}?${query}` : resolve('/orders'));
  }

  function clearStatusFilter() {
    const query = buildOrdersQuery({ status: 'all', page: '1' });
    // eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() is invoked inside the conditional expression
    void goto(query ? `${resolve('/orders')}?${query}` : resolve('/orders'));
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
    class="rounded-[2.5rem] border border-white/80 bg-[var(--gradient-section-alt)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.3em] uppercase">Orders</p>
        <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Semua transaksi Anda dalam satu timeline.
        </h1>
        <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
          Pantau status pembayaran, cek detail pesanan, dan lanjutkan transaksi yang masih pending
          tanpa mencari email konfirmasi.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="bg-card/80 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Total Orders
          </p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{data.meta.total}</p>
        </div>
        <div class="bg-card/80 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Current Page
          </p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{data.meta.page}</p>
        </div>
      </div>
    </div>
  </div>

  <Card
    class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
  >
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
          Order History
        </p>
        <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
          Daftar pesanan buyer
        </h2>
      </div>

      <div class="bg-muted text-muted-foreground rounded-full px-4 py-2 text-sm">
        Menampilkan {data.orders.length} dari {data.meta.total} order
      </div>
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <label class="text-foreground text-sm font-medium" for="status-filter">Status:</label>
        <Select
          id="status-filter"
          class="h-10 w-48 rounded-full"
          value={data.filters.status}
          onchange={handleStatusChange}
        >
          <option value="all">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </Select>
      </div>

      {#if data.filters.status !== 'all'}
        <button
          type="button"
          class="bg-card border-border text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition"
          onclick={clearStatusFilter}
        >
          <span class="capitalize">{data.filters.status}</span>
          <X class="size-3.5" />
        </button>
      {/if}
    </div>

    {#if data.orders.length === 0}
      <div class="mt-8">
        <EmptyState
          title="Belum ada order"
          description="Order yang Anda buat dari checkout akan tampil di sini lengkap dengan status pembayaran dan detail event."
        >
          {#snippet action()}
            <Button class="mt-6 px-5" onclick={() => goto(resolve('/events'))}
              >Jelajahi Event</Button
            >
          {/snippet}
        </EmptyState>
      </div>
    {:else}
      <div class="mt-8 space-y-4 lg:hidden">
        {#each data.orders as order (order.id)}
          <button
            type="button"
            class="border-border bg-muted hover:border-border hover:bg-card w-full rounded-[1.75rem] border p-5 text-left transition"
            onclick={() => goToOrder(order.id)}
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
                  {order.order_number}
                </p>
                <h3 class="text-foreground mt-2 text-xl font-semibold">{order.event_title}</h3>
                <p class="text-muted-foreground mt-2 text-sm">
                  Dibuat {formatRelativeTime(order.created_at)}
                </p>
              </div>
              <StatusBadge
                variant={getStatusVariant(order.status)}
                label={order.status.toUpperCase()}
                class="tracking-[0.2em]"
              />
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-2">
              <div class="bg-card rounded-2xl px-4 py-3">
                <p class="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
                  Tanggal Order
                </p>
                <p class="text-foreground mt-2 text-sm font-medium">
                  {formatLongDateTime(order.created_at)}
                </p>
              </div>
              <div class="bg-card rounded-2xl px-4 py-3">
                <p class="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase">
                  Total
                </p>
                <p class="text-foreground mt-2 text-sm font-medium">
                  {formatCurrency(order.total_amount)}
                </p>
              </div>
            </div>
          </button>
        {/each}
      </div>

      <div class="border-border mt-8 hidden overflow-hidden rounded-[1.75rem] border lg:block">
        <table class="divide-border bg-card min-w-full divide-y">
          <thead class="bg-muted">
            <tr
              class="text-muted-foreground text-left text-xs font-semibold tracking-[0.18em] uppercase"
            >
              <th class="px-6 py-4">Order</th>
              <th class="px-6 py-4">Event</th>
              <th class="px-6 py-4">Tanggal</th>
              <th class="px-6 py-4">Total</th>
              <th class="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody class="divide-border divide-y">
            {#each data.orders as order (order.id)}
              <tr>
                <td class="px-6 py-0" colspan="5">
                  <button
                    type="button"
                    class="hover:bg-muted grid w-full grid-cols-[1.2fr_1.4fr_1fr_1fr_0.9fr] items-center gap-4 py-5 text-left transition"
                    onclick={() => goToOrder(order.id)}
                  >
                    <div>
                      <p
                        class="text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase"
                      >
                        {order.order_number}
                      </p>
                      <p class="text-muted-foreground mt-2 text-sm">
                        Order dibuat {formatRelativeTime(order.created_at)}
                      </p>
                    </div>
                    <div>
                      <p class="text-foreground font-medium">{order.event_title}</p>
                      <p class="text-muted-foreground mt-1 text-sm">
                        Event ID {order.event_id.slice(0, 8)}...
                      </p>
                    </div>
                    <div class="text-foreground text-sm">
                      {formatLongDateTime(order.created_at)}
                    </div>
                    <div class="text-foreground text-sm font-semibold">
                      {formatCurrency(order.total_amount)}
                    </div>
                    <div>
                      <StatusBadge
                        variant={getStatusVariant(order.status)}
                        label={order.status.toUpperCase()}
                        class="tracking-[0.2em]"
                      />
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
          <p class="text-muted-foreground text-sm">
            Halaman {data.meta.page} dari {data.meta.totalPages}
          </p>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              class="px-4"
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
              class="px-4"
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
      class="bg-card/90 rounded-[1.75rem] border border-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex size-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"
        >
          <Wallet class="size-5" />
        </div>
        <div>
          <p class="text-foreground text-sm font-medium">Status pending tetap terlihat</p>
          <p class="text-muted-foreground mt-1 text-sm leading-6">
            Buka detail order untuk melanjutkan pembayaran sebelum batas waktu habis.
          </p>
        </div>
      </div>
    </Card>

    <Card
      class="bg-card/90 rounded-[1.75rem] border border-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
    >
      <div class="flex items-start gap-3">
        <div
          class="flex size-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"
        >
          <ReceiptText class="size-5" />
        </div>
        <div>
          <p class="text-foreground text-sm font-medium">Order confirmed siap dilacak</p>
          <p class="text-muted-foreground mt-1 text-sm leading-6">
            Begitu pembayaran sukses, order akan berubah menjadi confirmed dan mengarah ke tiket
            Anda.
          </p>
        </div>
      </div>
    </Card>

    <Card
      class="bg-card/90 rounded-[1.75rem] border border-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]"
    >
      <div class="flex items-start gap-3">
        <div class="flex size-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <CalendarDays class="size-5" />
        </div>
        <div>
          <p class="text-foreground text-sm font-medium">Semua timestamp tersimpan</p>
          <p class="text-muted-foreground mt-1 text-sm leading-6">
            Lihat kapan order dibuat, kapan pembayaran jatuh tempo, dan kapan event Anda
            berlangsung.
          </p>
        </div>
      </div>
    </Card>
  </div>
</section>
