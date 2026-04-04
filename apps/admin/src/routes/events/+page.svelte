<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { CalendarRange, RefreshCw, Search, Ticket } from '@lucide/svelte';
  import { Button, Card, DataTable, Input, Toast } from '@jeevatix/ui';

  import { apiGetEnvelope, ApiError } from '$lib/api';

  type EventStatus =
    | 'draft'
    | 'pending_review'
    | 'published'
    | 'rejected'
    | 'ongoing'
    | 'completed'
    | 'cancelled';

  type AdminEventListItem = {
    id: string;
    title: string;
    slug: string;
    status: EventStatus;
    venueCity: string;
    startAt: string;
    endAt: string;
    bannerUrl: string | null;
    sellerProfileId: string;
    sellerName: string;
    sellerUserId: string;
    sellerVerified: boolean;
    totalQuota: number;
    totalSold: number;
    createdAt: string;
    updatedAt: string;
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
    { key: 'title', header: 'Event' },
    { key: 'sellerLabel', header: 'Seller' },
    { key: 'statusLabel', header: 'Status' },
    { key: 'soldLabel', header: 'Terjual', align: 'right' as const },
    { key: 'scheduleLabel', header: 'Jadwal' },
    { key: 'updatedLabel', header: 'Update' },
  ];

  const statusOptions = [
    { value: 'all', label: 'Semua status' },
    { value: 'draft', label: 'Draft' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'published', label: 'Published' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ] as const;

  let events = $state<AdminEventListItem[]>([]);
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

  function formatEventStatus(status: EventStatus) {
    switch (status) {
      case 'pending_review':
        return 'Pending Review';
      case 'published':
        return 'Published';
      case 'rejected':
        return 'Rejected';
      case 'ongoing':
        return 'Ongoing';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Draft';
    }
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  function formatRange(startAt: string, endAt: string) {
    return `${formatDate(startAt)} - ${formatDate(endAt)}`;
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

  async function loadEvents(page = meta.page, showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const result = await apiGetEnvelope<AdminEventListItem[], PaginationMeta>(
        `/admin/events?${getQueryString(page)}`,
      );

      events = result.data;
      meta = result.meta ?? meta;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Gagal memuat daftar event.';
      pageError = message;
      setToast({ title: 'Gagal memuat event', description: message, variant: 'warning' });
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function applyFilters() {
    search = searchDraft.trim();
    void loadEvents(1, true);
  }

  function openEventDetail(row: Record<string, unknown>) {
    const event = row as AdminEventListItem;
    void goto(resolve(`/events/${event.id}`));
  }

  function previousPage() {
    if (meta.page > 1) {
      void loadEvents(meta.page - 1, true);
    }
  }

  function nextPage() {
    if (meta.totalPages > meta.page) {
      void loadEvents(meta.page + 1, true);
    }
  }

  const tableRows = $derived(
    events.map((event) => ({
      ...event,
      sellerLabel: `${event.sellerName}${event.sellerVerified ? ' • Verified' : ' • Pending'}`,
      statusLabel: formatEventStatus(event.status),
      soldLabel: `${event.totalSold} / ${event.totalQuota}`,
      scheduleLabel: formatRange(event.startAt, event.endAt),
      updatedLabel: formatDate(event.updatedAt),
    })),
  );

  const publishedCount = $derived(events.filter((event) => event.status === 'published').length);
  const ticketsSold = $derived(events.reduce((total, event) => total + event.totalSold, 0));

  onMount(async () => {
    await loadEvents();
  });
</script>

<svelte:head>
  <title>Events | Jeevatix Admin</title>
  <meta
    name="description"
    content="Pantau seluruh event di platform, filter berdasarkan status, dan buka review detail event dari admin portal Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-5 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A7</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Semua event</h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Tinjau semua event lintas seller, prioritaskan yang menunggu review, dan buka detail untuk
        mengubah status publikasi.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        type="button"
        onclick={() => loadEvents(meta.page, true)}
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
          <p class="text-sm text-slate-500">Total event</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{meta.total}</p>
        </div>
        <div class="bg-jeevatix-50 text-jeevatix-700 rounded-2xl p-3">
          <CalendarRange class="size-6" />
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
          <p class="text-sm text-slate-500">Published di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{publishedCount}</p>
        </div>
        <div class="bg-sea-50 text-sea-700 rounded-2xl p-3">
          <Ticket class="size-6" />
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
          <p class="text-sm text-slate-500">Tiket terjual di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{ticketsSold}</p>
        </div>
        <div class="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Search class="size-6" />
        </div>
      </div>
    </Card>
  </div>

  <Card
    title="Filter event"
    description="Gabungkan pencarian seller atau judul event dengan filter status untuk mempercepat review admin."
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
        <label class="text-sm font-medium text-slate-700" for="event-search">Cari event</label>
        <Input
          id="event-search"
          bind:value={searchDraft}
          placeholder="Judul event, nama seller, PIC, atau email seller"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="event-status-filter">Status</label>
        <select
          id="event-status-filter"
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
    <Toast
      title="Gagal memuat data"
      description={pageError}
      actionLabel={undefined}
      variant="warning"
    />
  {/if}

  <Card
    title="Daftar event platform"
    description="Buka detail event untuk meninjau seller, tier, statistik order, dan aksi perubahan status."
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
        emptyMessage="Tidak ada event yang cocok dengan filter saat ini."
        actionHeader="Review"
      >
        {#snippet rowActions(row)}
          <Button variant="outline" size="sm" type="button" onclick={() => openEventDetail(row)}>
            Detail
          </Button>
        {/snippet}
      </DataTable>
    {/if}

    {#snippet footer()}
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-500">
          Menampilkan <span class="font-semibold text-slate-900">{events.length}</span> dari {meta.total}
          event.
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
