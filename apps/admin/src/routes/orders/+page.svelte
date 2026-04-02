<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { CreditCard, Receipt, RefreshCw } from '@lucide/svelte';
  import { Button, Card, DataTable, Input, Toast } from '@jeevatix/ui';

  import { apiGetEnvelope, ApiError } from '$lib/api';

  type OrderStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
  type PaymentMethod = 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';

  type AdminOrderListItem = {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: number;
    serviceFee: number;
    createdAt: string;
    confirmedAt: string | null;
    expiresAt: string;
    paymentStatus: PaymentStatus;
    paymentMethod: PaymentMethod;
    buyer: {
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
    };
    event: {
      id: string;
      title: string;
      slug: string;
      venueCity: string;
      startAt: string;
    };
  };

  type PaginationMeta = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const columns = [
    { key: 'orderNumber', header: 'Order' },
    { key: 'buyerLabel', header: 'Buyer' },
    { key: 'eventLabel', header: 'Event' },
    { key: 'statusLabel', header: 'Order' },
    { key: 'paymentLabel', header: 'Pembayaran' },
    { key: 'totalLabel', header: 'Nilai', align: 'right' as const },
    { key: 'createdLabel', header: 'Dibuat' },
  ];

  const orderStatusOptions = [
    { value: 'all', label: 'Semua order' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'expired', label: 'Expired' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'refunded', label: 'Refunded' },
  ] as const;

  const paymentStatusOptions = [
    { value: 'all', label: 'Semua pembayaran' },
    { value: 'pending', label: 'Pending' },
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
  ] as const;

  let orders = $state<AdminOrderListItem[]>([]);
  let meta = $state<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  let search = $state('');
  let searchDraft = $state('');
  let statusFilter = $state<(typeof orderStatusOptions)[number]['value']>('all');
  let paymentStatusFilter = $state<(typeof paymentStatusOptions)[number]['value']>('all');
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let pageError = $state('');
  let toast = $state<ToastState | null>(null);

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3500);
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

  function formatOrderStatus(status: OrderStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function formatPaymentStatus(status: PaymentStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function formatPaymentMethod(method: PaymentMethod) {
    switch (method) {
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'credit_card':
        return 'Credit Card';
      case 'virtual_account':
        return 'Virtual Account';
      default:
        return 'E-Wallet';
    }
  }

  function getQueryString(page = meta.page) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(meta.limit),
    });

    if (search) {
      params.set('search', search);
    }

    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }

    if (paymentStatusFilter !== 'all') {
      params.set('paymentStatus', paymentStatusFilter);
    }

    return params.toString();
  }

  async function loadOrders(page = meta.page, showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const result = await apiGetEnvelope<AdminOrderListItem[], PaginationMeta>(
        `/admin/orders?${getQueryString(page)}`,
      );

      orders = result.data;
      meta = result.meta ?? meta;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Gagal memuat daftar order.';
      pageError = message;
      setToast({ title: 'Gagal memuat order', description: message, variant: 'warning' });
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function applyFilters() {
    search = searchDraft.trim();
    void loadOrders(1, true);
  }

  function openOrderDetail(row: Record<string, unknown>) {
    const order = row as AdminOrderListItem;
    void goto(resolve(`/orders/${order.id}`));
  }

  function previousPage() {
    if (meta.page > 1) {
      void loadOrders(meta.page - 1, true);
    }
  }

  function nextPage() {
    if (meta.totalPages > meta.page) {
      void loadOrders(meta.page + 1, true);
    }
  }

  const tableRows = $derived(
    orders.map((order) => ({
      ...order,
      buyerLabel: `${order.buyer.fullName} • ${order.buyer.email}`,
      eventLabel: `${order.event.title} • ${order.event.venueCity}`,
      statusLabel: formatOrderStatus(order.status),
      paymentLabel: `${formatPaymentStatus(order.paymentStatus)} • ${formatPaymentMethod(order.paymentMethod)}`,
      totalLabel: formatCurrency(order.totalAmount),
      createdLabel: formatDate(order.createdAt),
    })),
  );

  const confirmedCount = $derived(orders.filter((order) => order.status === 'confirmed').length);
  const totalValue = $derived(orders.reduce((total, order) => total + order.totalAmount, 0));

  onMount(async () => {
    await loadOrders();
  });
</script>

<svelte:head>
  <title>Orders | Jeevatix Admin</title>
  <meta
    name="description"
    content="Review seluruh order platform, buka detail transaksi, dan lakukan refund atau cancel dari admin portal Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-5 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A9</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Semua pesanan</h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Lacak order lintas event, cocokkan status order dan pembayaran, lalu buka detail untuk aksi refund atau cancel.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" type="button" onclick={() => loadOrders(meta.page, true)} disabled={isRefreshing || isLoading}>
        <RefreshCw class={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  </div>

  {#if toast}
    <Toast actionLabel={undefined} title={toast.title} description={toast.description} variant={toast.variant} />
  {/if}

  <div class="grid gap-4 md:grid-cols-3">
    <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-500">Total order</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{meta.total}</p>
        </div>
        <div class="bg-jeevatix-50 text-jeevatix-700 rounded-2xl p-3">
          <Receipt class="size-6" />
        </div>
      </div>
    </Card>
    <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-500">Confirmed di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{confirmedCount}</p>
        </div>
        <div class="bg-sea-50 text-sea-700 rounded-2xl p-3">
          <CreditCard class="size-6" />
        </div>
      </div>
    </Card>
    <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-500">Nilai transaksi di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{formatCurrency(totalValue)}</p>
        </div>
        <div class="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <RefreshCw class="size-6" />
        </div>
      </div>
    </Card>
  </div>

  <Card
    title="Filter pesanan"
    description="Cari berdasarkan nomor order, buyer, email, atau judul event, lalu kombinasikan dengan status order dan pembayaran."
    class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
  >
    <form
      class="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr_auto]"
      onsubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
    >
      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="order-search">Cari pesanan</label>
        <Input id="order-search" bind:value={searchDraft} placeholder="Nomor order, buyer, email, atau event" />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="order-status-filter">Status order</label>
        <select
          id="order-status-filter"
          bind:value={statusFilter}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
        >
          {#each orderStatusOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="payment-status-filter">Pembayaran</label>
        <select
          id="payment-status-filter"
          bind:value={paymentStatusFilter}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
        >
          {#each paymentStatusOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="flex items-end">
        <Button type="submit" class="w-full lg:w-auto">Terapkan</Button>
      </div>
    </form>
  </Card>

  {#if pageError}
    <Toast title="Gagal memuat data" description={pageError} actionLabel={undefined} variant="warning" />
  {/if}

  <Card
    title="Daftar pesanan"
    description="Masuk ke detail pesanan untuk melihat item, tiket terbit, dan aksi administratif yang tersedia."
    class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
  >
    {#if isLoading}
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {#each Array.from({ length: 4 }) as _, index (index)}
          <div class="h-28 animate-pulse rounded-[1.5rem] border border-slate-200 bg-slate-100"></div>
        {/each}
      </div>
    {:else}
      <DataTable title={undefined} description={undefined} {columns} rows={tableRows} emptyMessage="Tidak ada pesanan yang cocok dengan filter saat ini." actionHeader="Aksi">
        {#snippet rowActions(row)}
          <Button variant="outline" size="sm" type="button" onclick={() => openOrderDetail(row)}>
            Detail
          </Button>
        {/snippet}
      </DataTable>
    {/if}

    {#snippet footer()}
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-500">
          Menampilkan <span class="font-semibold text-slate-900">{orders.length}</span> dari {meta.total}
          pesanan.
        </p>
        <div class="flex items-center gap-3">
          <Button variant="outline" type="button" onclick={previousPage} disabled={meta.page <= 1 || isLoading}>
            Sebelumnya
          </Button>
          <span class="text-sm font-medium text-slate-600">Halaman {meta.page} / {Math.max(meta.totalPages, 1)}</span>
          <Button variant="outline" type="button" onclick={nextPage} disabled={meta.totalPages <= meta.page || isLoading}>
            Berikutnya
          </Button>
        </div>
      </div>
    {/snippet}
  </Card>
</section>