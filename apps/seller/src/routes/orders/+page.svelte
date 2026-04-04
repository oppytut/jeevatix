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
  import { Badge, Button, Card, Toast } from '@jeevatix/ui';

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
    class="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">S11</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Seller order board
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
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
      <div class="flex items-center justify-between text-slate-950">
        <span class="text-3xl font-semibold">{summary.totalOrders}</span>
        <ReceiptText class="size-5 text-slate-400" />
      </div>
    </Card>

    <Card title="Confirmed" description="Order dengan pembayaran sukses.">
      <div class="flex items-center justify-between text-slate-950">
        <span class="text-3xl font-semibold">{summary.confirmedOrders}</span>
        <ShoppingBag class="size-5 text-emerald-500" />
      </div>
    </Card>

    <Card title="Pending" description="Order yang belum selesai dibayar.">
      <div class="flex items-center justify-between text-slate-950">
        <span class="text-3xl font-semibold">{summary.pendingOrders}</span>
        <CalendarDays class="size-5 text-amber-500" />
      </div>
    </Card>

    <Card title="Revenue" description="Akumulasi nilai order confirmed di halaman ini.">
      <div class="flex items-center justify-between text-slate-950">
        <span class="text-2xl font-semibold">{formatCurrency(summary.totalRevenue)}</span>
        <Wallet class="size-5 text-sky-500" />
      </div>
    </Card>
  </div>

  <Card
    title="Filter orders"
    description="Saring daftar pesanan berdasarkan event yang Anda kelola dan status transaksi saat ini."
    class="rounded-[2rem] border-slate-200 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
  >
    <div class="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
      <label class="space-y-2 text-sm font-medium text-slate-700">
        <span>Event</span>
        <select
          class="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 transition outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          bind:value={selectedEventId}
        >
          <option value="all">Semua event</option>
          {#each events as event (event.id)}
            <option value={event.id}>{event.title}</option>
          {/each}
        </select>
      </label>

      <label class="space-y-2 text-sm font-medium text-slate-700">
        <span>Status</span>
        <select
          class="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 transition outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
          bind:value={selectedStatus}
        >
          {#each statusOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
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
    class="rounded-[2rem] border-slate-200 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
  >
    {#if isLoading}
      <div class="py-16 text-center text-sm text-slate-500">Memuat pesanan seller...</div>
    {:else if orders.length === 0}
      <div class="py-16 text-center text-sm text-slate-500">
        Belum ada pesanan yang cocok dengan filter aktif.
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead>
            <tr class="text-slate-500">
              <th class="px-4 py-3 font-semibold">Order</th>
              <th class="px-4 py-3 font-semibold">Event</th>
              <th class="px-4 py-3 font-semibold">Buyer</th>
              <th class="px-4 py-3 font-semibold">Total</th>
              <th class="px-4 py-3 font-semibold">Status</th>
              <th class="px-4 py-3 font-semibold">Tanggal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            {#each orders as order (order.id)}
              <tr
                class="cursor-pointer transition hover:bg-slate-50"
                onclick={() => openOrder(order.id)}
              >
                <td class="px-4 py-4 align-top">
                  <div class="font-semibold text-slate-950">{order.order_number}</div>
                  <div class="mt-1 text-xs text-slate-500">Payment: {order.payment_status}</div>
                </td>
                <td class="px-4 py-4 align-top text-slate-700">{order.event_title}</td>
                <td class="px-4 py-4 align-top">
                  <div class="font-medium text-slate-900">{order.buyer_name}</div>
                  <div class="mt-1 text-xs text-slate-500">{order.buyer_email}</div>
                </td>
                <td class="px-4 py-4 align-top font-medium text-slate-900"
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
                <td class="px-4 py-4 align-top text-slate-600">{formatDate(order.created_at)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}

    <div
      class="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm text-slate-500">
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
