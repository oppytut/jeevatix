<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import {
    CalendarDays,
    Filter,
    ReceiptText,
    RefreshCw,
    ShoppingBag,
    Wallet,
  } from '@lucide/svelte';
  import { Badge, Button, Card, EmptyState, Select, Toast } from '@jeevatix/ui';

  import { ApiError, apiGetResponse } from '$lib/api';

  type PaginationMeta = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  type SellerEventOption = {
    id: string;
    title: string;
  };

  type SellerOrder = {
    id: string;
    order_number: string;
    status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
    total_amount: number;
    buyer_id: string;
    buyer_name: string;
    buyer_email: string;
    event_id: string;
    event_title: string;
    event_slug: string;
    payment_status: 'pending' | 'success' | 'failed' | 'refunded';
    created_at: string;
    confirmed_at: string | null;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const statusOptions: Array<{ label: string; value: SellerOrder['status'] | 'all' }> = [
    { label: 'Semua status', value: 'all' },
    { label: 'Pending', value: 'pending' },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Expired', value: 'expired' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'Refunded', value: 'refunded' },
  ];

  let orders = $state<SellerOrder[]>([]);
  let events = $state<SellerEventOption[]>([]);
  let meta = $state<PaginationMeta>({ total: 0, page: 1, limit: 10, totalPages: 0 });
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let pageError = $state('');
  let toast = $state<ToastState | null>(null);
  let selectedStatus = $state<SellerOrder['status'] | 'all'>('all');
  let selectedEventId = $state('all');

  const summary = $derived({
    totalOrders: meta.total,
    confirmedOrders: orders.filter((order) => order.status === 'confirmed').length,
    pendingOrders: orders.filter((order) => order.status === 'pending').length,
    totalRevenue: orders
      .filter((order) => order.status === 'confirmed')
      .reduce((sum, order) => sum + order.total_amount, 0),
  });

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3600);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function getStatusVariant(status: SellerOrder['status']) {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'expired':
      case 'cancelled':
        return 'warning';
      case 'refunded':
        return 'neutral';
      default:
        return 'default';
    }
  }

  function getPaymentVariant(status: SellerOrder['payment_status']) {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'warning';
      case 'refunded':
        return 'neutral';
      default:
        return 'default';
    }
  }

  function buildQuery(page = meta.page) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(meta.limit),
    });

    if (selectedStatus !== 'all') {
      params.set('status', selectedStatus);
    }

    if (selectedEventId !== 'all') {
      params.set('event_id', selectedEventId);
    }

    return params.toString();
  }

  async function loadEventOptions() {
    try {
      const response = await apiGetResponse<Array<{ id: string; title: string }>, PaginationMeta>(
        '/seller/events?page=1&limit=100',
      );
      events = response.data.map((event) => ({ id: event.id, title: event.title }));
    } catch {
      events = [];
    }
  }

  async function loadOrders(page = 1, refresh = false) {
    pageError = '';

    if (refresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const response = await apiGetResponse<SellerOrder[], PaginationMeta>(
        `/seller/orders?${buildQuery(page)}`,
      );
      orders = response.data;
      meta = response.meta ?? {
        total: response.data.length,
        page,
        limit: meta.limit,
        totalPages: 1,
      };
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat pesanan seller.';
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  async function applyFilters() {
    meta.page = 1;
    await loadOrders(1, true);
  }

  async function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > Math.max(meta.totalPages, 1) || nextPage === meta.page) {
      return;
    }

    await loadOrders(nextPage, true);
  }

  function openOrder(orderId: string) {
    void goto(resolve(`/orders/${orderId}` as `/orders/${string}`));
  }

  onMount(async () => {
    await Promise.all([loadEventOptions(), loadOrders()]);
    if (orders.length > 0) {
      setToast({
        title: 'Seller orders ready',
        description: 'Daftar pesanan berhasil dimuat dan siap dipantau.',
        variant: 'default',
      });
    }
  });
</script>

<svelte:head>
  <title>Seller Orders | Jeevatix</title>
  <meta
    name="description"
    content="Pantau semua pesanan untuk event seller, filter berdasarkan event dan status, lalu buka detail order dengan cepat."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="border-border bg-card/90 rounded-[2rem] border p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.32em] uppercase">S11</p>
        <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Seller order board
        </h1>
        <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
          Monitor semua transaksi untuk event Anda, lihat buyer yang masuk, dan buka detail order
          untuk tindak lanjut operasional.
        </p>
      </div>

      <Button
        variant="outline"
        type="button"
        onclick={() => loadOrders(meta.page, true)}
        disabled={isLoading || isRefreshing}
      >
        <RefreshCw class={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  </div>

  {#if toast}
    <Toast
      title={toast.title}
      description={toast.description}
      variant={toast.variant}
      actionLabel={undefined}
    />
  {/if}

  {#if pageError}
    <Toast
      title="Gagal memuat pesanan"
      description={pageError}
      variant="warning"
      actionLabel={undefined}
    />
  {/if}

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <Card title="Total Orders" description="Semua order yang cocok dengan filter aktif.">
      <div class="text-foreground flex items-center justify-between">
        <span class="text-3xl font-semibold">{summary.totalOrders}</span>
        <ReceiptText class="text-muted-foreground/70 size-5" />
      </div>
    </Card>

    <Card title="Confirmed" description="Order dengan pembayaran sukses.">
      <div class="text-foreground flex items-center justify-between">
        <span class="text-3xl font-semibold">{summary.confirmedOrders}</span>
        <ShoppingBag class="size-5 text-emerald-500" />
      </div>
    </Card>

    <Card title="Pending" description="Order yang belum selesai dibayar.">
      <div class="text-foreground flex items-center justify-between">
        <span class="text-3xl font-semibold">{summary.pendingOrders}</span>
        <CalendarDays class="size-5 text-amber-500" />
      </div>
    </Card>

    <Card title="Revenue" description="Akumulasi nilai order confirmed di halaman ini.">
      <div class="text-foreground flex items-center justify-between">
        <span class="text-2xl font-semibold">{formatCurrency(summary.totalRevenue)}</span>
        <Wallet class="size-5 text-sky-500" />
      </div>
    </Card>
  </div>

  <Card
    title="Filter orders"
    description="Saring daftar pesanan berdasarkan event yang Anda kelola dan status transaksi saat ini."
    class="border-border bg-card/90 rounded-[2rem] shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
  >
    <div class="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
      <label class="text-foreground space-y-2 text-sm font-medium">
        <span>Event</span>
        <Select class="h-12 rounded-full" bind:value={selectedEventId}>
          <option value="all">Semua event</option>
          {#each events as event (event.id)}
            <option value={event.id}>{event.title}</option>
          {/each}
        </Select>
      </label>

      <label class="text-foreground space-y-2 text-sm font-medium">
        <span>Status</span>
        <Select class="h-12 rounded-full" bind:value={selectedStatus}>
          {#each statusOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </Select>
      </label>

      <div class="flex items-end">
        <Button type="button" class="h-12 rounded-full px-6" onclick={applyFilters}>
          <Filter class="mr-2 size-4" />
          Terapkan Filter
        </Button>
      </div>
    </div>
  </Card>

  <Card
    title="Daftar pesanan"
    description="Klik satu baris untuk membuka detail order lengkap, buyer info, dan status pembayaran."
    class="border-border bg-card/90 rounded-[2rem] shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
  >
    {#if isLoading}
      <div class="text-muted-foreground py-16 text-center text-sm">Memuat pesanan seller...</div>
    {:else if orders.length === 0}
      <div class="py-16">
        <EmptyState title="Belum ada pesanan yang cocok dengan filter aktif" />
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="divide-border min-w-full divide-y text-left text-sm">
          <thead>
            <tr class="text-muted-foreground">
              <th class="px-4 py-3 font-semibold">Order</th>
              <th class="px-4 py-3 font-semibold">Event</th>
              <th class="px-4 py-3 font-semibold">Buyer</th>
              <th class="px-4 py-3 font-semibold">Total</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold">Tanggal</th>
            </tr>
          </thead>
          <tbody class="divide-border divide-y">
            {#each orders as order (order.id)}
              <tr
                class="hover:bg-muted cursor-pointer transition"
                onclick={() => openOrder(order.id)}
              >
                <td class="px-4 py-4 align-top">
                  <div class="text-foreground font-semibold">{order.order_number}</div>
                  <div class="text-muted-foreground mt-1 text-xs">
                    Payment: {order.payment_status}
                  </div>
                </td>
                <td class="text-foreground px-4 py-4 align-top">{order.event_title}</td>
                <td class="px-4 py-4 align-top">
                  <div class="text-foreground font-medium">{order.buyer_name}</div>
                  <div class="text-muted-foreground mt-1 text-xs">{order.buyer_email}</div>
                </td>
                <td class="text-foreground px-4 py-4 align-top font-medium"
                  >{formatCurrency(order.total_amount)}</td
                >
                <td class="px-4 py-4 align-top">
                  <div class="flex flex-col gap-2">
                    <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                    <Badge variant={getPaymentVariant(order.payment_status)}
                      >{order.payment_status}</Badge
                    >
                  </div>
                </td>
                <td class="text-muted-foreground px-4 py-4 align-top"
                  >{formatDate(order.created_at)}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <div
      class="border-border mt-6 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-muted-foreground text-sm">
        Page {meta.page} dari {Math.max(meta.totalPages, 1)} • Total {meta.total} order
      </p>
      <div class="flex items-center gap-3">
        <Button
          variant="outline"
          type="button"
          onclick={() => changePage(meta.page - 1)}
          disabled={meta.page <= 1 || isRefreshing}
        >
          Sebelumnya
        </Button>
        <Button
          variant="outline"
          type="button"
          onclick={() => changePage(meta.page + 1)}
          disabled={meta.page >= meta.totalPages || meta.totalPages === 0 || isRefreshing}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  </Card>
</section>
