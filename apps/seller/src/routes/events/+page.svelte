<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { CalendarDays, Eye, Pencil, Plus, RefreshCw, Ticket, Trash2 } from '@lucide/svelte';
  import { Badge, Button, Card, DataTable, Toast } from '@jeevatix/ui';

  import { ApiError, apiDelete, apiGetResponse } from '$lib/api';

  type EventStatus =
    | 'draft'
    | 'pending_review'
    | 'published'
    | 'rejected'
    | 'ongoing'
    | 'completed'
    | 'cancelled';

  type SellerEventListItem = {
    id: string;
    title: string;
    slug: string;
    venue_city: string;
    start_at: string;
    end_at: string;
    sale_start_at: string;
    sale_end_at: string;
    banner_url: string | null;
    status: EventStatus;
    max_tickets_per_order: number;
    total_quota: number;
    total_sold: number;
    created_at: string;
    updated_at: string;
  };

  type EventListResponse = {
    data: SellerEventListItem[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };

  type TableRow = {
    id: string;
    title: string;
    status: EventStatus;
    schedule: string;
    soldSummary: string;
    city: string;
    original: SellerEventListItem;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const statusOptions: Array<{ label: string; value: EventStatus | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Pending Review', value: 'pending_review' },
    { label: 'Published', value: 'published' },
    { label: 'Rejected', value: 'rejected' },
    { label: 'Completed', value: 'completed' },
  ];

  const columns = [
    { key: 'title', header: 'Title' },
    { key: 'status', header: 'Status' },
    { key: 'schedule', header: 'Tanggal' },
    { key: 'soldSummary', header: 'Tiket Terjual', align: 'right' as const },
  ];

  let events = $state<SellerEventListItem[]>([]);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let pageError = $state('');
  let selectedStatus = $state<EventStatus | 'all'>('all');
  let toast = $state<ToastState | null>(null);
  let deletingEventId = $state<string | null>(null);

  const summary = $derived({
    totalEvents: events.length,
    totalQuota: events.reduce((sum, event) => sum + event.total_quota, 0),
    totalSold: events.reduce((sum, event) => sum + event.total_sold, 0),
    liveEvents: events.filter((event) => ['published', 'ongoing'].includes(event.status)).length,
  });

  const tableRows = $derived<TableRow[]>(
    events.map((event) => ({
      id: event.id,
      title: event.title,
      status: event.status,
      schedule: formatDateRange(event.start_at, event.end_at),
      soldSummary: `${event.total_sold}/${event.total_quota}`,
      city: event.venue_city,
      original: event,
    })),
  );

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3600);
  }

  function formatDateRange(startAt: string, endAt: string) {
    const start = new Date(startAt);
    const end = new Date(endAt);

    return `${start.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })} • ${start.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })} - ${end.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  function getStatusBadgeVariant(status: EventStatus) {
    switch (status) {
      case 'published':
      case 'ongoing':
        return 'success';
      case 'rejected':
      case 'cancelled':
        return 'warning';
      case 'completed':
        return 'neutral';
      default:
        return 'default';
    }
  }

  function getStatusLabel(status: EventStatus) {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'pending_review':
        return 'Review';
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
    }
  }

  async function loadEvents(showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const searchParams = new URLSearchParams({ page: '1', limit: '20' });

      if (selectedStatus !== 'all') {
        searchParams.set('status', selectedStatus);
      }

      const response = await apiGetResponse<SellerEventListItem[], EventListResponse['meta']>(
        `/seller/events?${searchParams.toString()}`,
      );
      events = response.data;
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat daftar event seller.';
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  async function changeStatusFilter(nextStatus: EventStatus | 'all') {
    selectedStatus = nextStatus;
    await loadEvents(true);
  }

  async function deleteEvent(event: SellerEventListItem) {
    if (
      deletingEventId ||
      !window.confirm(`Hapus event \"${event.title}\"? Hanya event draft yang bisa dihapus.`)
    ) {
      return;
    }

    deletingEventId = event.id;

    try {
      await apiDelete<{ message: string }>(`/seller/events/${event.id}`);
      setToast({
        title: 'Event dihapus',
        description: `${event.title} berhasil dihapus dari workspace seller.`,
        variant: 'success',
      });
      await loadEvents(true);
    } catch (error) {
      setToast({
        title: 'Gagal menghapus event',
        description:
          error instanceof ApiError ? error.message : 'Event tidak dapat dihapus saat ini.',
        variant: 'warning',
      });
    } finally {
      deletingEventId = null;
    }
  }

  function goToEvent(eventId: string) {
    void goto(resolve(`/events/${eventId}`));
  }

  onMount(async () => {
    await loadEvents();
  });
</script>

<svelte:head>
  <title>Seller Events | Jeevatix</title>
  <meta
    name="description"
    content="Kelola seluruh event seller, pantau status publikasi, dan akses cepat ke detail maupun tier tiket."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">S6</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Workspace event seller
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Lihat seluruh event milik Anda, filter berdasarkan status publikasi, dan lanjutkan ke
          halaman detail, edit, atau manajemen tier tiket.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          type="button"
          onclick={() => loadEvents(true)}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw class={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button type="button" onclick={() => goto(resolve('/events/create'))}>
          <Plus class="mr-2 size-4" />
          Buat Event
        </Button>
      </div>
    </div>

    <div class="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
        <p class="text-sm text-slate-500">Total Event</p>
        <p class="mt-3 text-3xl font-semibold text-slate-950">{summary.totalEvents}</p>
      </div>
      <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
        <p class="text-sm text-slate-500">Published / Ongoing</p>
        <p class="mt-3 text-3xl font-semibold text-slate-950">{summary.liveEvents}</p>
      </div>
      <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
        <p class="text-sm text-slate-500">Total Kuota</p>
        <p class="mt-3 text-3xl font-semibold text-slate-950">{summary.totalQuota}</p>
      </div>
      <div class="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-5">
        <p class="text-sm text-slate-500">Tiket Terjual</p>
        <p class="mt-3 text-3xl font-semibold text-slate-950">{summary.totalSold}</p>
      </div>
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
      title="Gagal memuat data"
      description={pageError}
      variant="warning"
      actionLabel={undefined}
    />
  {/if}

  <Card
    title="Daftar event"
    description="Status, jadwal, dan progres penjualan semua event seller ditampilkan di satu tabel kerja."
    class="rounded-[2rem] border border-slate-200/80 bg-white/95 shadow-sm"
  >
    <div class="mb-5 flex flex-wrap gap-2">
      {#each statusOptions as option (option.value)}
        <button
          class={`rounded-full border px-4 py-2 text-sm font-medium transition ${selectedStatus === option.value ? 'border-jeevatix-600 bg-jeevatix-600 text-white' : 'hover:border-jeevatix-300 hover:bg-jeevatix-50 border-slate-200 bg-white text-slate-600 hover:text-slate-950'}`}
          onclick={() => changeStatusFilter(option.value)}
          type="button"
        >
          {option.label}
        </button>
      {/each}
    </div>

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
        actionHeader="Aksi"
        emptyMessage="Belum ada event. Mulai dengan membuat event pertama seller Anda."
        onRowClick={(row) => goToEvent((row as TableRow).id)}
      >
        {#snippet cell(row, column)}
          {@const event = (row as TableRow).original}
          {#if column.key === 'title'}
            <div class="space-y-1">
              <p class="font-semibold text-slate-950">{event.title}</p>
              <p class="text-xs text-slate-500">{event.venue_city}</p>
            </div>
          {:else if column.key === 'status'}
            <Badge variant={getStatusBadgeVariant(event.status)}
              >{getStatusLabel(event.status)}</Badge
            >
          {:else if column.key === 'schedule'}
            <div class="space-y-1 text-sm">
              <p class="font-medium text-slate-800">
                {formatDateRange(event.start_at, event.end_at)}
              </p>
              <p class="text-xs text-slate-500">
                Jual: {formatDateRange(event.sale_start_at, event.sale_end_at)}
              </p>
            </div>
          {:else if column.key === 'soldSummary'}
            <div class="space-y-2 text-right">
              <p class="font-semibold text-slate-950">{event.total_sold}/{event.total_quota}</p>
              <div class="ml-auto h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                <div
                  class="bg-jeevatix-600 h-full rounded-full"
                  style={`width: ${event.total_quota === 0 ? 0 : Math.min(100, (event.total_sold / event.total_quota) * 100)}%`}
                ></div>
              </div>
            </div>
          {:else}
            —
          {/if}
        {/snippet}

        {#snippet rowActions(row)}
          {@const event = (row as TableRow).original}
          <div class="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onclick={(clickEvent: MouseEvent) => {
                clickEvent.stopPropagation();
                goToEvent(event.id);
              }}
            >
              <Eye class="mr-2 size-3.5" />
              Detail
            </Button>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onclick={(clickEvent: MouseEvent) => {
                clickEvent.stopPropagation();
                goto(resolve(`/events/${event.id}/edit`));
              }}
            >
              <Pencil class="mr-2 size-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onclick={(clickEvent: MouseEvent) => {
                clickEvent.stopPropagation();
                goto(resolve(`/events/${event.id}/tiers`));
              }}
            >
              <Ticket class="mr-2 size-3.5" />
              Tiers
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              class="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              disabled={event.status !== 'draft' || deletingEventId === event.id}
              onclick={(clickEvent: MouseEvent) => {
                clickEvent.stopPropagation();
                deleteEvent(event);
              }}
            >
              <Trash2 class="mr-2 size-3.5" />
              Hapus
            </Button>
          </div>
        {/snippet}
      </DataTable>
    {/if}
  </Card>

  <div class="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
    <Card
      title="Next moves"
      description="Jalur kerja tercepat setelah event dibuat."
      class="rounded-[2rem] border border-slate-200/80 bg-white/95"
    >
      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
          <CalendarDays class="text-jeevatix-600 size-5" />
          <p class="mt-4 font-semibold text-slate-950">Lengkapi jadwal</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Pastikan sale window dan waktu event sinkron sebelum submit review.
          </p>
        </div>
        <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
          <Ticket class="text-jeevatix-600 size-5" />
          <p class="mt-4 font-semibold text-slate-950">Atur tier tiket</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Kelola harga, quota, dan urutan tier dari halaman khusus per event.
          </p>
        </div>
        <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
          <Eye class="text-jeevatix-600 size-5" />
          <p class="mt-4 font-semibold text-slate-950">Review detail</p>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Gunakan halaman detail untuk cek progress tier sebelum event masuk proses review.
          </p>
        </div>
      </div>
    </Card>

    <Card
      title="Catatan status"
      description="Interpretasi cepat untuk badge event seller."
      class="rounded-[2rem] border border-slate-200/80 bg-white/95"
    >
      <div class="space-y-3 text-sm text-slate-600">
        <p>
          <span class="font-semibold text-slate-900">Draft</span> berarti event masih aman untuk dihapus.
        </p>
        <p>
          <span class="font-semibold text-slate-900">Pending Review</span> berarti event sedang menunggu
          keputusan admin.
        </p>
        <p>
          <span class="font-semibold text-slate-900">Rejected</span> berarti seller bisa revisi lalu submit
          ulang lewat edit/detail page.
        </p>
        <p>
          <span class="font-semibold text-slate-900">Published / Ongoing</span> berarti event sudah live
          dan tidak boleh melakukan perubahan destruktif pada tier yang punya penjualan.
        </p>
      </div>
    </Card>
  </div>
</section>
