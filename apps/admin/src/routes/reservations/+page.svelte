<script lang="ts">
  import { Clock3, RefreshCw, TicketCheck } from '@lucide/svelte';
  import { Badge, Button, Card, DataTable, Input, Select, Toast } from '@jeevatix/ui';

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
  let now = $state(Date.now());

  $effect(() => {
    const interval = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => clearInterval(interval);
  });

  $effect(() => {
    void loadReservations();
  });

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

  function formatCountdown(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - now;
    if (diff <= 0) {
      return { text: 'Expired', expired: true };
    }
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return { text: `${minutes}m ${seconds}s`, expired: false };
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

  function getTierVariant(status: TicketTierStatus): 'default' | 'success' | 'neutral' | 'warning' {
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
    reservations.map((reservation) => {
      const countdown =
        reservation.status === 'active' ? formatCountdown(reservation.expiresAt) : null;
      return {
        ...reservation,
        buyerLabel: `${reservation.buyer.fullName} - ${reservation.buyer.email}`,
        eventLabel: `${reservation.event.title} - ${reservation.event.venueCity}`,
        tierLabel: `${reservation.ticketTier.name} - ${reservation.ticketTier.status}`,
        statusLabel: reservation.status,
        expiryLabel:
          reservation.status === 'active' && countdown
            ? `${formatDate(reservation.expiresAt)} - ${countdown.text}`
            : formatDate(reservation.expiresAt),
        countdownExpired: countdown?.expired ?? false,
      };
    }),
  );

  const activeCount = $derived(reservations.filter((item) => item.status === 'active').length);
  const quantityCount = $derived(reservations.reduce((total, item) => total + item.quantity, 0));
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
    class="border-border bg-card/85 flex flex-col gap-5 rounded-[2rem] border p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-muted-foreground text-sm font-semibold tracking-[0.32em] uppercase">A15</p>
      <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
        Reservations
      </h1>
      <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
        Monitor reservasi tiket lintas event untuk mendeteksi lock inventory yang masih aktif atau
        macet.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        type="button"
        onclick={() => loadReservations(meta.page, true)}
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
      class="border-border bg-card/90 rounded-[1.75rem] border"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-muted-foreground text-sm">Total reservasi</p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{meta.total}</p>
        </div>
        <div class="bg-jeevatix-50 text-jeevatix-700 rounded-2xl p-3">
          <Clock3 class="size-6" />
        </div>
      </div>
    </Card>
    <Card
      title={undefined}
      description={undefined}
      class="border-border bg-card/90 rounded-[1.75rem] border"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-muted-foreground text-sm">Active di hasil</p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{activeCount}</p>
        </div>
        <div class="bg-sea-50 text-sea-700 rounded-2xl p-3">
          <TicketCheck class="size-6" />
        </div>
      </div>
    </Card>
    <Card
      title={undefined}
      description={undefined}
      class="border-border bg-card/90 rounded-[1.75rem] border"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-muted-foreground text-sm">Qty di hasil</p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{quantityCount}</p>
        </div>
        <div class="bg-muted text-foreground rounded-2xl p-3">
          <RefreshCw class="size-6" />
        </div>
      </div>
    </Card>
  </div>

  <Card
    title="Filter reservasi"
    description="Cari buyer, event, atau tier untuk menemukan reservation lock yang perlu dimonitor."
    class="border-border bg-card/90 rounded-[2rem] border shadow-sm"
  >
    <form
      class="grid gap-4 lg:grid-cols-[1.8fr_1fr_auto]"
      onsubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
    >
      <div class="space-y-2">
        <label class="text-foreground text-sm font-medium" for="reservation-search"
          >Cari reservasi</label
        >
        <Input
          id="reservation-search"
          bind:value={searchDraft}
          placeholder="Buyer, email, tier, atau event"
        />
      </div>

      <div class="space-y-2">
        <label class="text-foreground text-sm font-medium" for="reservation-status">Status</label>
        <Select id="reservation-status" bind:value={statusFilter} class="h-11 rounded-full">
          {#each statusOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </Select>
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
    title="Daftar reservasi"
    description="Fokus pada reservation aktif yang hampir kedaluwarsa atau terjebak pada tier yang sold out."
    class="border-border bg-card/90 rounded-[2rem] border shadow-sm"
  >
    {#if isLoading}
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {#each Array.from({ length: 4 }) as _, index (index)}
          <div class="border-border bg-muted h-28 animate-pulse rounded-[1.5rem] border"></div>
        {/each}
      </div>
    {:else}
      <DataTable
        title={undefined}
        description={undefined}
        {columns}
        rows={tableRows}
        emptyMessage="Tidak ada reservasi yang cocok dengan filter saat ini."
      >
        {#snippet cell(row, column)}
          {@const reservation = row as AdminReservationItem}
          {#if column.key === 'tierLabel'}
            <div class="space-y-1">
              <p class="text-foreground font-semibold">{reservation.ticketTier.name}</p>
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
        <p class="text-muted-foreground text-sm">
          Menampilkan <span class="text-foreground font-semibold">{reservations.length}</span> dari {meta.total}
          reservasi.
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
          <span class="text-muted-foreground text-sm font-medium"
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
