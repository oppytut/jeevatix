<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import {
    CalendarRange,
    RefreshCw,
    Search,
    Ticket,
    CheckCircle,
    XCircle,
    X,
  } from '@lucide/svelte';
  import { Button, Card, DataTable, Input, Select, Toast } from '@jeevatix/ui';

  import { apiGetEnvelope, apiPatch, ApiError } from '$lib/api';

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
  let selectedIds = $state<string[]>([]);
  let isBulkProcessing = $state(false);
  let bulkProgress = $state({ current: 0, total: 0 });

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

  const selectedPendingEvents = $derived(
    events.filter((event) => selectedIds.includes(event.id) && event.status === 'pending_review'),
  );

  const selectedNonPendingCount = $derived(
    selectedIds.filter((id) => {
      const event = events.find((e) => e.id === id);
      return event && event.status !== 'pending_review';
    }).length,
  );

  function clearSelection() {
    selectedIds = [];
  }

  async function bulkUpdateStatus(targetStatus: 'published' | 'rejected') {
    if (selectedPendingEvents.length === 0) {
      setToast({
        title: 'Tidak ada event',
        description: 'Tidak ada event pending_review yang dipilih.',
        variant: 'warning',
      });
      return;
    }

    isBulkProcessing = true;
    bulkProgress = { current: 0, total: selectedPendingEvents.length };

    let successCount = 0;
    let failCount = 0;

    for (const event of selectedPendingEvents) {
      try {
        await apiPatch(`/admin/events/${event.id}/status`, { status: targetStatus });
        successCount++;
      } catch (error) {
        failCount++;
        console.error(`Failed to update event ${event.id}:`, error);
      }
      bulkProgress.current++;
    }

    isBulkProcessing = false;
    clearSelection();

    if (failCount === 0) {
      setToast({
        title: 'Berhasil',
        description: `${successCount} event berhasil diperbarui.`,
        variant: 'success',
      });
    } else {
      setToast({
        title: 'Selesai dengan error',
        description: `${successCount} berhasil, ${failCount} gagal.`,
        variant: 'warning',
      });
    }

    await loadEvents(meta.page, true);
  }

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
    class="border-border bg-card/85 flex flex-col gap-5 rounded-[2rem] border p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-muted-foreground text-sm font-semibold tracking-[0.32em] uppercase">A7</p>
      <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">Semua event</h1>
      <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
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

  {#if selectedIds.length > 0}
    <div
      class="sticky top-4 z-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-blue-200 bg-blue-50 p-3 shadow-lg dark:border-blue-800 dark:bg-blue-900/20"
    >
      <div class="flex items-center gap-3">
        <p class="text-foreground text-sm font-semibold">
          {selectedPendingEvents.length} event dipilih
        </p>
        {#if selectedNonPendingCount > 0}
          <p class="text-muted-foreground text-xs">
            ({selectedPendingEvents.length} dari {selectedIds.length} dapat dimoderasi)
          </p>
        {/if}
        {#if isBulkProcessing}
          <p class="text-muted-foreground text-xs">
            Memproses {bulkProgress.current}/{bulkProgress.total}...
          </p>
        {/if}
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onclick={clearSelection}
          disabled={isBulkProcessing}
        >
          <X class="mr-1 size-4" />
          Batal
        </Button>
        <Button
          variant="default"
          size="sm"
          type="button"
          onclick={() => bulkUpdateStatus('published')}
          disabled={isBulkProcessing || selectedPendingEvents.length === 0}
          class="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle class="mr-1 size-4" />
          Setujui Semua
        </Button>
        <Button
          variant="default"
          size="sm"
          type="button"
          onclick={() => bulkUpdateStatus('rejected')}
          disabled={isBulkProcessing || selectedPendingEvents.length === 0}
          class="bg-red-600 hover:bg-red-700"
        >
          <XCircle class="mr-1 size-4" />
          Tolak Semua
        </Button>
      </div>
    </div>
  {/if}

  <div class="grid gap-4 md:grid-cols-3">
    <Card
      title={undefined}
      description={undefined}
      class="border-border bg-card/90 rounded-[1.75rem] border"
    >
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-muted-foreground text-sm">Total event</p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{meta.total}</p>
        </div>
        <div class="bg-jeevatix-50 text-jeevatix-700 rounded-2xl p-3">
          <CalendarRange class="size-6" />
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
          <p class="text-muted-foreground text-sm">Published di hasil</p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{publishedCount}</p>
        </div>
        <div class="bg-sea-50 text-sea-700 rounded-2xl p-3">
          <Ticket class="size-6" />
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
          <p class="text-muted-foreground text-sm">Tiket terjual di hasil</p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{ticketsSold}</p>
        </div>
        <div class="bg-muted text-muted-foreground rounded-2xl p-3">
          <Search class="size-6" />
        </div>
      </div>
    </Card>
  </div>

  <Card
    title="Filter event"
    description="Gabungkan pencarian seller atau judul event dengan filter status untuk mempercepat review admin."
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
        <label class="text-foreground text-sm font-medium" for="event-search">Cari event</label>
        <Input
          id="event-search"
          bind:value={searchDraft}
          placeholder="Judul event, nama seller, PIC, atau email seller"
        />
      </div>

      <div class="space-y-2">
        <label class="text-foreground text-sm font-medium" for="event-status-filter">Status</label>
        <Select id="event-status-filter" bind:value={statusFilter} class="h-11 rounded-full">
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
    title="Daftar event platform"
    description="Buka detail event untuk meninjau seller, tier, statistik order, dan aksi perubahan status."
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
        emptyMessage="Tidak ada event yang cocok dengan filter saat ini."
        actionHeader="Review"
        selectable={true}
        bind:selectedIds
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
        <p class="text-muted-foreground text-sm">
          Menampilkan <span class="text-foreground font-semibold">{events.length}</span> dari {meta.total}
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
