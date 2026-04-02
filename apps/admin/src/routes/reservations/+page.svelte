<script lang="ts">
  import { onMount } from 'svelte';
  import { Clock3, RefreshCw, TicketCheck } from '@lucide/svelte';
  import { Badge, Button, Card, DataTable, Input, Toast } from '@jeevatix/ui';

  import { apiGetEnvelope, ApiError } from '$lib/api';

  type ReservationStatus = 'active' | 'converted' | 'expired' | 'cancelled';
  type TicketTierStatus = 'available' | 'sold_out' | 'hidden';

  type AdminReservationItem = {
    id: string;
    status: ReservationStatus;
    quantity: number;
    expiresAt: string;
    createdAt: string;
    remainingSeconds: number;
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
    ticketTier: {
      id: string;
      name: string;
      status: TicketTierStatus;
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
    { key: 'buyerLabel', header: 'Buyer' },
    { key: 'eventLabel', header: 'Event' },
    { key: 'tierLabel', header: 'Tier' },
    { key: 'statusLabel', header: 'Reservasi' },
    { key: 'quantity', header: 'Qty', align: 'right' as const },
    { key: 'expiryLabel', header: 'Expired' },
  ];

  const statusOptions = [
    { value: 'all', label: 'Semua status' },
    { value: 'active', label: 'Active' },
    { value: 'converted', label: 'Converted' },
    { value: 'expired', label: 'Expired' },
    { value: 'cancelled', label: 'Cancelled' },
  ] as const;

  let reservations = $state<AdminReservationItem[]>([]);
  let meta = $state<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  let search = $state('');
  let searchDraft = $state('');
  let statusFilter = $state<(typeof statusOptions)[number]['value']>('all');
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

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function formatDuration(seconds: number) {
    if (seconds <= 0) {
      return 'Habis';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
  }

  function getReservationVariant(
    status: ReservationStatus,
  ): 'default' | 'success' | 'neutral' | 'warning' {
    switch (status) {
      case 'active':
        return 'warning';
      case 'converted':
        return 'success';
      case 'expired':
      case 'cancelled':
        return 'neutral';
    }
  }

  function getTierVariant(
    status: TicketTierStatus,
  ): 'default' | 'success' | 'neutral' | 'warning' {
    switch (status) {
      case 'available':
        return 'success';
      case 'sold_out':
        return 'warning';
      case 'hidden':
        return 'neutral';
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

    return params.toString();
  }

  async function loadReservations(page = meta.page, showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const result = await apiGetEnvelope<AdminReservationItem[], PaginationMeta>(
        `/admin/reservations?${getQueryString(page)}`,
      );

      reservations = result.data;
      meta = result.meta ?? meta;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Gagal memuat reservasi.';
      pageError = message;
      setToast({ title: 'Gagal memuat reservasi', description: message, variant: 'warning' });
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function applyFilters() {
    search = searchDraft.trim();
    void loadReservations(1, true);
  }

  function previousPage() {
    if (meta.page > 1) {
      void loadReservations(meta.page - 1, true);
    }
  }

  function nextPage() {
    if (meta.totalPages > meta.page) {
      void loadReservations(meta.page + 1, true);
    }
  }

  const tableRows = $derived(
    reservations.map((reservation) => ({
      ...reservation,
      buyerLabel: `${reservation.buyer.fullName} - ${reservation.buyer.email}`,
      eventLabel: `${reservation.event.title} - ${reservation.event.venueCity}`,
      tierLabel: `${reservation.ticketTier.name} - ${reservation.ticketTier.status}`,
      statusLabel: reservation.status,
      expiryLabel:
        reservation.status === 'active'
          ? `${formatDate(reservation.expiresAt)} - ${formatDuration(reservation.remainingSeconds)}`
          : formatDate(reservation.expiresAt),
    })),
  );

  const activeCount = $derived(reservations.filter((item) => item.status === 'active').length);
  const quantityCount = $derived(reservations.reduce((total, item) => total + item.quantity, 0));

  onMount(async () => {
    await loadReservations();
  });
</script>

<svelte:head>
  <title>Reservations | Jeevatix Admin</title>
  <meta
    name="description"
    content="Pantau seluruh reservasi tiket yang aktif, converted, expired, atau cancelled dari admin portal Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-5 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A15</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Reservations</h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Monitor reservasi tiket lintas event untuk mendeteksi lock inventory yang masih aktif atau macet.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" type="button" onclick={() => loadReservations(meta.page, true)} disabled={isRefreshing || isLoading}>
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
          <p class="text-sm text-slate-500">Total reservasi</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{meta.total}</p>
        </div>
        <div class="bg-jeevatix-50 text-jeevatix-700 rounded-2xl p-3">
          <Clock3 class="size-6" />
        </div>
      </div>
    </Card>
    <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-500">Active di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{activeCount}</p>
        </div>
        <div class="bg-sea-50 text-sea-700 rounded-2xl p-3">
          <TicketCheck class="size-6" />
        </div>
      </div>
    </Card>
    <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm text-slate-500">Qty di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{quantityCount}</p>
        </div>
        <div class="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <RefreshCw class="size-6" />
        </div>
      </div>
    </Card>
  </div>

  <Card
    title="Filter reservasi"
    description="Cari buyer, event, atau tier untuk menemukan reservation lock yang perlu dimonitor."
    class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
  >
    <form
      class="grid gap-4 lg:grid-cols-[1.8fr_1fr_auto]"
      onsubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
    >
      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="reservation-search">Cari reservasi</label>
        <Input id="reservation-search" bind:value={searchDraft} placeholder="Buyer, email, tier, atau event" />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="reservation-status">Status</label>
        <select
          id="reservation-status"
          bind:value={statusFilter}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
        >
          {#each statusOptions as option (option.value)}
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
    title="Daftar reservasi"
    description="Fokus pada reservation aktif yang hampir kedaluwarsa atau terjebak pada tier yang sold out."
    class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
  >
    {#if isLoading}
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {#each Array.from({ length: 4 }) as _, index (index)}
          <div class="h-28 animate-pulse rounded-[1.5rem] border border-slate-200 bg-slate-100"></div>
        {/each}
      </div>
    {:else}
      <DataTable title={undefined} description={undefined} {columns} rows={tableRows} emptyMessage="Tidak ada reservasi yang cocok dengan filter saat ini.">
        {#snippet cell(row, column)}
          {@const reservation = row as AdminReservationItem}
          {#if column.key === 'tierLabel'}
            <div class="space-y-1">
              <p class="font-semibold text-slate-950">{reservation.ticketTier.name}</p>
              <Badge variant={getTierVariant(reservation.ticketTier.status)}>
                {reservation.ticketTier.status}
              </Badge>
            </div>
          {:else if column.key === 'statusLabel'}
            <Badge variant={getReservationVariant(reservation.status)}>{reservation.status}</Badge>
          {:else}
            {(row as Record<string, unknown>)[column.key]}
          {/if}
        {/snippet}
      </DataTable>
    {/if}

    {#snippet footer()}
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-500">
          Menampilkan <span class="font-semibold text-slate-900">{reservations.length}</span> dari {meta.total}
          reservasi.
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