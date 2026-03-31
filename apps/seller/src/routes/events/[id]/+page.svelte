<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    CalendarDays,
    ChartColumn,
    ImagePlus,
    LoaderCircle,
    MapPinned,
    Pencil,
    Send,
    Ticket,
  } from '@lucide/svelte';
  import { Badge, Button, Card, Toast } from '@jeevatix/ui';

  import { ApiError, apiGet, apiPost } from '$lib/api';

  type EventStatus =
    | 'draft'
    | 'pending_review'
    | 'published'
    | 'rejected'
    | 'ongoing'
    | 'completed'
    | 'cancelled';

  type SellerEventDetail = {
    id: string;
    seller_profile_id: string;
    title: string;
    slug: string;
    description: string | null;
    venue_name: string;
    venue_address: string | null;
    venue_city: string;
    venue_latitude: number | null;
    venue_longitude: number | null;
    start_at: string;
    end_at: string;
    sale_start_at: string;
    sale_end_at: string;
    banner_url: string | null;
    status: EventStatus;
    max_tickets_per_order: number;
    total_quota: number;
    total_sold: number;
    categories: Array<{ id: number; name: string; slug: string; icon: string | null }>;
    images: Array<{ id: string; image_url: string; sort_order: number; created_at: string }>;
    tiers: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      quota: number;
      sold_count: number;
      sort_order: number;
      status: 'available' | 'sold_out' | 'hidden';
      sale_start_at: string | null;
      sale_end_at: string | null;
      created_at: string;
      updated_at: string;
    }>;
    created_at: string;
    updated_at: string;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const eventId = $derived(page.params.id);

  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let pageError = $state('');
  let toast = $state<ToastState | null>(null);
  let eventDetail = $state<SellerEventDetail | null>(null);

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3600);
  }

  function formatDateTime(value: string | null) {
    if (!value) {
      return '—';
    }

    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
    }
  }

  async function loadEventDetail() {
    isLoading = true;
    pageError = '';

    try {
      eventDetail = await apiGet<SellerEventDetail>(`/seller/events/${eventId}`);
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat detail event seller.';
    } finally {
      isLoading = false;
    }
  }

  async function submitForReview() {
    if (!eventDetail || isSubmitting) {
      return;
    }

    isSubmitting = true;

    try {
      eventDetail = await apiPost<SellerEventDetail>(`/seller/events/${eventDetail.id}/submit`);
      setToast({
        title: 'Event dikirim untuk review',
        description: 'Status event berhasil diubah ke pending review.',
        variant: 'success',
      });
    } catch (error) {
      setToast({
        title: 'Gagal submit review',
        description: error instanceof ApiError ? error.message : 'Event belum bisa dikirim ulang untuk review.',
        variant: 'warning',
      });
    } finally {
      isSubmitting = false;
    }
  }

  function goToEdit() {
    if (!eventDetail) {
      return;
    }

    void goto(resolve(`/events/${eventDetail.id}/edit`));
  }

  function goToTiers() {
    if (!eventDetail) {
      return;
    }

    void goto(resolve(`/events/${eventDetail.id}/tiers`));
  }

  const summary = $derived(
    eventDetail
      ? {
          soldPercentage:
            eventDetail.total_quota === 0
              ? 0
              : Math.min(100, (eventDetail.total_sold / eventDetail.total_quota) * 100),
          activeTiers: eventDetail.tiers.filter((tier) => tier.status === 'available').length,
        }
      : { soldPercentage: 0, activeTiers: 0 },
  );

  onMount(async () => {
    await loadEventDetail();
  });
</script>

<svelte:head>
  <title>Seller Event Detail | Jeevatix</title>
  <meta
    name="description"
    content="Pantau detail event seller, distribusi penjualan per tier, dan akses aksi edit maupun submit review."
  />
</svelte:head>

<section class="space-y-8">
  {#if toast}
    <Toast title={toast.title} description={toast.description} variant={toast.variant} actionLabel={undefined} />
  {/if}

  {#if pageError}
    <Toast title="Gagal memuat detail event" description={pageError} variant="warning" actionLabel={undefined} />
  {/if}

  {#if isLoading}
    <div class="space-y-6">
      <div class="h-64 animate-pulse rounded-[2rem] border border-slate-200 bg-slate-100"></div>
      <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div class="h-130 animate-pulse rounded-[2rem] border border-slate-200 bg-slate-100"></div>
        <div class="h-130 animate-pulse rounded-[2rem] border border-slate-200 bg-slate-100"></div>
      </div>
    </div>
  {:else if eventDetail}
    <div class="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div class="relative h-72 overflow-hidden bg-slate-100">
        {#if eventDetail.banner_url}
          <img class="h-full w-full object-cover" src={eventDetail.banner_url} alt={eventDetail.title} />
        {:else}
          <div class="flex h-full items-center justify-center text-sm text-slate-500">Banner event belum tersedia.</div>
        {/if}
        <div class="absolute inset-0 bg-linear-to-t from-slate-950/80 via-slate-950/20 to-transparent"></div>
        <div class="absolute inset-x-0 bottom-0 p-8 sm:p-10">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div class="space-y-3 text-white">
              <div class="flex flex-wrap items-center gap-3">
                <Badge variant={getStatusBadgeVariant(eventDetail.status)}>{getStatusLabel(eventDetail.status)}</Badge>
                <span class="text-sm font-medium text-white/80">{eventDetail.venue_city}</span>
              </div>
              <h1 class="text-4xl font-semibold tracking-tight sm:text-5xl">{eventDetail.title}</h1>
              <p class="max-w-3xl text-sm leading-6 text-white/80">{eventDetail.description ?? 'Belum ada deskripsi event.'}</p>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <Button variant="outline" type="button" class="border-white/30 bg-white/10 text-white hover:bg-white/20" onclick={() => goto(resolve('/events'))}>
                <ArrowLeft class="mr-2 size-4" />
                Daftar Event
              </Button>
              <Button variant="outline" type="button" class="border-white/30 bg-white/10 text-white hover:bg-white/20" onclick={goToTiers}>
                <Ticket class="mr-2 size-4" />
                Kelola Tier
              </Button>
              <Button type="button" onclick={goToEdit}>
                <Pencil class="mr-2 size-4" />
                Edit Event
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-[1.6rem] border border-slate-200/80 bg-white p-6 shadow-sm">
        <p class="text-sm text-slate-500">Tiket Terjual</p>
        <p class="mt-3 text-3xl font-semibold text-slate-950">{eventDetail.total_sold}</p>
      </div>
      <div class="rounded-[1.6rem] border border-slate-200/80 bg-white p-6 shadow-sm">
        <p class="text-sm text-slate-500">Total Quota</p>
        <p class="mt-3 text-3xl font-semibold text-slate-950">{eventDetail.total_quota}</p>
      </div>
      <div class="rounded-[1.6rem] border border-slate-200/80 bg-white p-6 shadow-sm">
        <p class="text-sm text-slate-500">Active Tiers</p>
        <p class="mt-3 text-3xl font-semibold text-slate-950">{summary.activeTiers}</p>
      </div>
      <div class="rounded-[1.6rem] border border-slate-200/80 bg-white p-6 shadow-sm">
        <p class="text-sm text-slate-500">Sell-through</p>
        <p class="mt-3 text-3xl font-semibold text-slate-950">{summary.soldPercentage.toFixed(0)}%</p>
      </div>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div class="space-y-6">
        <Card
          title="Informasi event"
          description="Ringkasan info operasional yang akan tampil ke pembeli saat event dipublikasikan."
          class="rounded-[2rem] border border-slate-200/80 bg-white/95"
        >
          <div class="grid gap-5 lg:grid-cols-2">
            <div class="space-y-4 text-sm text-slate-600">
              <div class="flex items-start gap-3">
                <CalendarDays class="mt-0.5 size-4 text-jeevatix-600" />
                <div>
                  <p class="font-semibold text-slate-950">Jadwal Event</p>
                  <p>{formatDateTime(eventDetail.start_at)} → {formatDateTime(eventDetail.end_at)}</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <ChartColumn class="mt-0.5 size-4 text-jeevatix-600" />
                <div>
                  <p class="font-semibold text-slate-950">Jendela Penjualan</p>
                  <p>{formatDateTime(eventDetail.sale_start_at)} → {formatDateTime(eventDetail.sale_end_at)}</p>
                </div>
              </div>
            </div>
            <div class="space-y-4 text-sm text-slate-600">
              <div class="flex items-start gap-3">
                <MapPinned class="mt-0.5 size-4 text-jeevatix-600" />
                <div>
                  <p class="font-semibold text-slate-950">Venue</p>
                  <p>{eventDetail.venue_name}</p>
                  <p>{eventDetail.venue_address ?? 'Alamat venue belum diisi.'}</p>
                  <p>{eventDetail.venue_city}</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <Ticket class="mt-0.5 size-4 text-jeevatix-600" />
                <div>
                  <p class="font-semibold text-slate-950">Max per Order</p>
                  <p>{eventDetail.max_tickets_per_order} tiket</p>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-5 flex flex-wrap gap-2">
            {#each eventDetail.categories as category (category.id)}
              <Badge variant="default">{category.name}</Badge>
            {/each}
          </div>
        </Card>

        <Card
          title="Distribusi penjualan per tier"
          description="Grafik bar sederhana untuk membaca kontribusi tiap tier terhadap penjualan event."
          class="rounded-[2rem] border border-slate-200/80 bg-white/95"
        >
          <div class="space-y-4">
            {#each eventDetail.tiers as tier (tier.id)}
              {@const soldPercentage = tier.quota === 0 ? 0 : Math.min(100, (tier.sold_count / tier.quota) * 100)}
              <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="font-semibold text-slate-950">{tier.name}</p>
                    <p class="mt-1 text-sm text-slate-500">Rp {tier.price.toLocaleString('id-ID')} • {tier.status}</p>
                  </div>
                  <p class="text-sm font-medium text-slate-700">{tier.sold_count}/{tier.quota}</p>
                </div>
                <div class="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div class="h-full rounded-full bg-jeevatix-600" style={`width: ${soldPercentage}%`}></div>
                </div>
              </div>
            {/each}
          </div>
        </Card>

        <Card
          title="Galeri event"
          description="Preview aset tambahan yang akan muncul di detail page pembeli."
          class="rounded-[2rem] border border-slate-200/80 bg-white/95"
        >
          {#if eventDetail.images.length > 0}
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {#each eventDetail.images as image (image.id)}
                <img class="h-44 w-full rounded-[1.4rem] object-cover" src={image.image_url} alt="Galeri event" />
              {/each}
            </div>
          {:else}
            <div class="flex h-40 items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
              Belum ada galeri tambahan untuk event ini.
            </div>
          {/if}
        </Card>
      </div>

      <div class="space-y-6">
        <Card
          title="Aksi cepat"
          description="Tombol operasional utama untuk event seller."
          class="rounded-[2rem] border border-slate-200/80 bg-white/95"
        >
          <div class="space-y-3">
            <Button class="w-full" type="button" onclick={goToEdit}>
              <Pencil class="mr-2 size-4" />
              Edit Event
            </Button>
            <Button class="w-full" variant="outline" type="button" onclick={goToTiers}>
              <Ticket class="mr-2 size-4" />
              Kelola Tier Tiket
            </Button>
            {#if eventDetail.status === 'draft' || eventDetail.status === 'rejected'}
              <Button class="w-full" variant="secondary" type="button" onclick={submitForReview} disabled={isSubmitting}>
                {#if isSubmitting}
                  <LoaderCircle class="mr-2 size-4 animate-spin" />
                  Mengirim...
                {:else}
                  <Send class="mr-2 size-4" />
                  Submit Review
                {/if}
              </Button>
            {/if}
          </div>
        </Card>

        <Card
          title="Daftar pesanan terbaru"
          description="Panel ini disiapkan untuk integrasi penuh setelah Seller Order API di T-7.5 tersedia."
          class="rounded-[2rem] border border-slate-200/80 bg-white/95"
        >
          <div class="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50/70 p-5 text-sm leading-6 text-slate-500">
            Data pesanan masuk belum tersedia di kontrak API saat fase ini. Halaman detail tetap menampilkan statistik tier dan readiness event, lalu akan diperkaya order feed saat T-7.5 selesai.
          </div>
        </Card>

        <Card
          title="Metadata"
          description="Informasi audit untuk aktivitas seller pada event ini."
          class="rounded-[2rem] border border-slate-200/80 bg-white/95"
        >
          <div class="space-y-3 text-sm text-slate-600">
            <p><span class="font-semibold text-slate-950">Created:</span> {formatDateTime(eventDetail.created_at)}</p>
            <p><span class="font-semibold text-slate-950">Updated:</span> {formatDateTime(eventDetail.updated_at)}</p>
            <p><span class="font-semibold text-slate-950">Slug:</span> {eventDetail.slug}</p>
          </div>
        </Card>
      </div>
    </div>
  {/if}
</section>