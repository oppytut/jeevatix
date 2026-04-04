<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { BanknoteArrowUp, CreditCard, RefreshCw } from '@lucide/svelte';
  import { Button, Card, DataTable, Input, Toast } from '@jeevatix/ui';

  import { apiGetEnvelope, ApiError } from '$lib/api';

  type OrderStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
  type PaymentMethod = 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';

  type AdminPaymentListItem = {
    id: string;
    orderId: string;
    orderNumber: string;
    status: PaymentStatus;
    method: PaymentMethod;
    amount: number;
    externalRef: string | null;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
    orderStatus: OrderStatus;
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
    { key: 'statusLabel', header: 'Status' },
    { key: 'methodLabel', header: 'Metode' },
    { key: 'amountLabel', header: 'Nilai', align: 'right' as const },
    { key: 'paidLabel', header: 'Paid At' },
  ];

  const paymentStatusOptions = [
    { value: 'all', label: 'Semua status' },
    { value: 'pending', label: 'Pending' },
    { value: 'success', label: 'Success' },
    { value: 'failed', label: 'Failed' },
    { value: 'refunded', label: 'Refunded' },
  ] as const;

  const methodOptions = [
    { value: 'all', label: 'Semua metode' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'e_wallet', label: 'E-Wallet' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'virtual_account', label: 'Virtual Account' },
  ] as const;

  let payments = $state<AdminPaymentListItem[]>([]);
  let meta = $state<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  let search = $state('');
  let searchDraft = $state('');
  let statusFilter = $state<(typeof paymentStatusOptions)[number]['value']>('all');
  let methodFilter = $state<(typeof methodOptions)[number]['value']>('all');
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

  function formatDate(value: string | null) {
    if (!value) {
      return 'Belum dibayar';
    }

    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function formatPaymentStatus(status: PaymentStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function formatMethod(method: PaymentMethod) {
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

    if (methodFilter !== 'all') {
      params.set('method', methodFilter);
    }

    return params.toString();
  }

  async function loadPayments(page = meta.page, showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const result = await apiGetEnvelope<AdminPaymentListItem[], PaginationMeta>(
        `/admin/payments?${getQueryString(page)}`,
      );

      payments = result.data;
      meta = result.meta ?? meta;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Gagal memuat daftar pembayaran.';
      pageError = message;
      setToast({ title: 'Gagal memuat pembayaran', description: message, variant: 'warning' });
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function applyFilters() {
    search = searchDraft.trim();
    void loadPayments(1, true);
  }

  function openPaymentDetail(row: Record<string, unknown>) {
    const payment = row as AdminPaymentListItem;
    void goto(resolve(`/payments/${payment.id}`));
  }

  function previousPage() {
    if (meta.page > 1) {
      void loadPayments(meta.page - 1, true);
    }
  }

  function nextPage() {
    if (meta.totalPages > meta.page) {
      void loadPayments(meta.page + 1, true);
    }
  }

  const tableRows = $derived(
    payments.map((payment) => ({
      ...payment,
      buyerLabel: `${payment.buyer.fullName} • ${payment.buyer.email}`,
      eventLabel: `${payment.event.title} • ${payment.event.venueCity}`,
      statusLabel: `${formatPaymentStatus(payment.status)} • ${payment.orderStatus}`,
      methodLabel: formatMethod(payment.method),
      amountLabel: formatCurrency(payment.amount),
      paidLabel: formatDate(payment.paidAt),
    })),
  );

  const successCount = $derived(payments.filter((payment) => payment.status === 'success').length);
  const totalAmount = $derived(payments.reduce((total, payment) => total + payment.amount, 0));

  onMount(async () => {
    await loadPayments();
  });
</script>

<svelte:head>
  <title>Payments | Jeevatix Admin</title>
  <meta
    name="description"
    content="Rekonsiliasi pembayaran platform, tinjau status method dan order terkait, lalu buka detail untuk update manual bila diperlukan."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-5 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A11</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Semua pembayaran
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Pantau seluruh pembayaran, identifikasi transaksi yang bermasalah, dan buka detail untuk
        penyesuaian status manual.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        type="button"
        onclick={() => loadPayments(meta.page, true)}
        disabled={isRefreshing || isLoading}
      >
        <RefreshCw class={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  </div>

  {#if toast}
    <Toast
      actionLabel={undefined}
      title={toast.title}
      description={toast.description}
      variant={toast.variant}
    />
  {/if}

  <div class="grid gap-4 md:grid-cols-3">
    <Card
      title={undefined}
      description={undefined}
      class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-500">Total pembayaran</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{meta.total}</p>
        </div>
        <div class="bg-jeevatix-50 text-jeevatix-700 rounded-2xl p-3">
          <CreditCard class="size-6" />
        </div>
      </div>
    </Card>
    <Card
      title={undefined}
      description={undefined}
      class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-500">Success di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{successCount}</p>
        </div>
        <div class="bg-sea-50 text-sea-700 rounded-2xl p-3">
          <BanknoteArrowUp class="size-6" />
        </div>
      </div>
    </Card>
    <Card
      title={undefined}
      description={undefined}
      class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-500">Nilai pembayaran di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{formatCurrency(totalAmount)}</p>
        </div>
        <div class="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <RefreshCw class="size-6" />
        </div>
      </div>
    </Card>
  </div>

  <Card
    title="Filter pembayaran"
    description="Telusuri pembayaran berdasarkan external ref, nomor order, buyer, event, status, dan metode pembayaran."
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
        <label class="text-sm font-medium text-slate-700" for="payment-search"
          >Cari pembayaran</label
        >
        <Input
          id="payment-search"
          bind:value={searchDraft}
          placeholder="External ref, nomor order, buyer, atau event"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="payment-status-filter">Status</label>
        <select
          id="payment-status-filter"
          bind:value={statusFilter}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
        >
          {#each paymentStatusOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="payment-method-filter">Metode</label>
        <select
          id="payment-method-filter"
          bind:value={methodFilter}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
        >
          {#each methodOptions as option (option.value)}
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
    <Toast
      title="Gagal memuat data"
      description={pageError}
      actionLabel={undefined}
      variant="warning"
    />
  {/if}

  <Card
    title="Daftar pembayaran"
    description="Gunakan detail pembayaran untuk melihat order terkait, tiket terbit, dan jalankan koreksi status bila dibutuhkan."
    class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
  >
    {#if isLoading}
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {#each Array.from({ length: 4 }) as _, index (index)}
          <div
            class="h-28 animate-pulse rounded-[1.5rem] border border-slate-200 bg-slate-100"
          ></div>
        {/each}
      </div>
    {:else}
      <DataTable
        title={undefined}
        description={undefined}
        {columns}
        rows={tableRows}
        emptyMessage="Tidak ada pembayaran yang cocok dengan filter saat ini."
        actionHeader="Aksi"
      >
        {#snippet rowActions(row)}
          <Button variant="outline" size="sm" type="button" onclick={() => openPaymentDetail(row)}>
            Detail
          </Button>
        {/snippet}
      </DataTable>
    {/if}

    {#snippet footer()}
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-500">
          Menampilkan <span class="font-semibold text-slate-900">{payments.length}</span> dari {meta.total}
          pembayaran.
        </p>
        <div class="flex items-center gap-3">
          <Button
            variant="outline"
            type="button"
            onclick={previousPage}
            disabled={meta.page <= 1 || isLoading}
          >
            Sebelumnya
          </Button>
          <span class="text-sm font-medium text-slate-600"
            >Halaman {meta.page} / {Math.max(meta.totalPages, 1)}</span
          >
          <Button
            variant="outline"
            type="button"
            onclick={nextPage}
            disabled={meta.totalPages <= meta.page || isLoading}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    {/snippet}
  </Card>
</section>
