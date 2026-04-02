<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';
  import { onMount } from 'svelte';
  import { ArrowLeft, BadgeCheck, CircleX, RefreshCw } from '@lucide/svelte';
  import { Badge, Button, Card, Modal, Toast } from '@jeevatix/ui';

  import { apiGet, apiPatch, ApiError } from '$lib/api';

  type EventStatus =
    | 'draft'
    | 'pending_review'
    | 'published'
    | 'rejected'
    | 'ongoing'
    | 'completed'
    | 'cancelled';

  type AdminEventDetail = {
    id: string;
    sellerProfileId: string;
    title: string;
    slug: string;
    description: string | null;
    venueName: string;
    venueAddress: string | null;
    venueCity: string;
    venueLatitude: number | null;
    venueLongitude: number | null;
    startAt: string;
    endAt: string;
    saleStartAt: string;
    saleEndAt: string;
    bannerUrl: string | null;
    status: EventStatus;
    maxTicketsPerOrder: number;
    isFeatured: boolean;
    createdAt: string;
    updatedAt: string;
    seller: {
      id: string;
      userId: string;
      orgName: string;
      orgDescription: string | null;
      logoUrl: string | null;
      isVerified: boolean;
      fullName: string;
      email: string;
      phone: string | null;
    };
    categories: Array<{
      id: number;
      name: string;
      slug: string;
      icon: string | null;
    }>;
    images: Array<{
      id: string;
      imageUrl: string;
      sortOrder: number;
      createdAt: string;
    }>;
    tiers: Array<{
      id: string;
      name: string;
      description: string | null;
      price: number;
      quota: number;
      soldCount: number;
      sortOrder: number;
      status: 'available' | 'sold_out' | 'hidden';
      saleStartAt: string | null;
      saleEndAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    stats: {
      orderCount: number;
      confirmedOrderCount: number;
      ticketsSold: number;
      grossRevenue: number;
    };
  };

  type EventStatusPayload = {
    id: string;
    status: EventStatus;
    updatedAt: string;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const statusActions: Array<{ status: EventStatus; label: string; description: string }> = [
    {
      status: 'pending_review',
      label: 'Kembalikan ke review',
      description: 'Gunakan ini bila seller perlu memperbaiki detail event sebelum publish.',
    },
    {
      status: 'published',
      label: 'Publish event',
      description: 'Event akan tampil di portal buyer dan bisa menerima penjualan tiket.',
    },
    {
      status: 'rejected',
      label: 'Reject event',
      description: 'Gunakan saat event tidak lolos moderasi atau butuh revisi besar.',
    },
    {
      status: 'cancelled',
      label: 'Cancel event',
      description: 'Gunakan jika event harus dihentikan dari sisi operasional platform.',
    },
  ];

  let { params }: PageProps = $props();

  let eventDetail = $state<AdminEventDetail | null>(null);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let isSubmitting = $state(false);
  let pageError = $state('');
  let pendingStatus = $state<EventStatus | null>(null);
  let isConfirmOpen = $state(false);
  let toast = $state<ToastState | null>(null);

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3500);
  }

  function formatDate(value: string | null) {
    if (!value) {
      return ' - ';
    }

    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
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

  function getStatusVariant(status: EventStatus): 'default' | 'success' | 'neutral' | 'warning' {
    switch (status) {
      case 'published':
      case 'ongoing':
      case 'completed':
        return 'success';
      case 'pending_review':
        return 'warning';
      case 'cancelled':
      case 'rejected':
        return 'neutral';
      default:
        return 'default';
    }
  }

  function formatTierStatus(status: 'available' | 'sold_out' | 'hidden') {
    switch (status) {
      case 'sold_out':
        return 'Sold Out';
      case 'hidden':
        return 'Hidden';
      default:
        return 'Available';
    }
  }

  async function loadEventDetail(showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      eventDetail = await apiGet<AdminEventDetail>(`/admin/events/${params.id}`);
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat detail event.';
      eventDetail = null;
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function requestStatusChange(status: EventStatus) {
    pendingStatus = status;
    isConfirmOpen = true;
  }

  async function confirmStatusChange() {
    if (!eventDetail || !pendingStatus || isSubmitting) {
      return;
    }

    isSubmitting = true;

    try {
      const updated = await apiPatch<EventStatusPayload>(`/admin/events/${eventDetail.id}/status`, {
        status: pendingStatus,
      });

      eventDetail = {
        ...eventDetail,
        status: updated.status,
        updatedAt: updated.updatedAt,
      };
      isConfirmOpen = false;
      setToast({
        title: 'Status event diperbarui',
        description: `${eventDetail.title} sekarang berstatus ${formatEventStatus(updated.status)}.`,
        variant: 'success',
      });
    } catch (error) {
      setToast({
        title: 'Gagal memperbarui status',
        description: error instanceof ApiError ? error.message : 'Perubahan status event gagal disimpan.',
        variant: 'warning',
      });
    } finally {
      isSubmitting = false;
      pendingStatus = null;
    }
  }

  const totalQuota = $derived(
    eventDetail ? eventDetail.tiers.reduce((total, tier) => total + tier.quota, 0) : 0,
  );

  onMount(async () => {
    await loadEventDetail();
  });
</script>

<svelte:head>
  <title>Event Detail | Jeevatix Admin</title>
  <meta
    name="description"
    content="Review detail event, seller, tier tiket, dan ubah status publikasi dari admin portal Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-4 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A8</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Detail event
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Audit seller, kategori, jadwal penjualan, dan tier tiket sebelum mengambil keputusan status.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" type="button" onclick={() => goto(resolve('/events'))}>
        <ArrowLeft class="mr-2 size-4" />
        Kembali ke daftar
      </Button>
      <Button
        variant="outline"
        type="button"
        onclick={() => loadEventDetail(true)}
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

  {#if pageError}
    <Toast
      title="Gagal memuat detail"
      description={pageError}
      actionLabel={undefined}
      variant="warning"
    />
  {/if}

  {#if isLoading}
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {#each Array.from({ length: 4 }) as _, index (index)}
        <div class="h-28 animate-pulse rounded-[1.5rem] border border-slate-200 bg-slate-100"></div>
      {/each}
    </div>
  {:else if eventDetail}
    <div class="grid gap-4 md:grid-cols-4">
      <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
        <p class="text-sm text-slate-500">Status</p>
        <div class="mt-3">
          <Badge variant={getStatusVariant(eventDetail.status)}>
            {formatEventStatus(eventDetail.status)}
          </Badge>
        </div>
      </Card>
      <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
        <p class="text-sm text-slate-500">Order masuk</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">{eventDetail.stats.orderCount}</p>
      </Card>
      <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
        <p class="text-sm text-slate-500">Tiket terjual</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">{eventDetail.stats.ticketsSold}</p>
      </Card>
      <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
        <p class="text-sm text-slate-500">Gross revenue</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">
          {formatCurrency(eventDetail.stats.grossRevenue)}
        </p>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card
        title="Ringkasan event"
        description="Data utama yang terlihat buyer dan seller, termasuk venue dan jendela penjualan."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-6">
          {#if eventDetail.bannerUrl}
            <img
              src={eventDetail.bannerUrl}
              alt={eventDetail.title}
              class="h-56 w-full rounded-[1.5rem] object-cover"
            />
          {/if}

          <div class="grid gap-6 md:grid-cols-2">
            <div class="md:col-span-2">
              <p class="text-sm text-slate-500">Judul event</p>
              <p class="mt-2 text-xl font-semibold text-slate-950">{eventDetail.title}</p>
              <p class="mt-2 text-sm text-slate-500">/{eventDetail.slug}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Venue</p>
              <p class="mt-2 text-base font-medium text-slate-900">{eventDetail.venueName}</p>
              <p class="mt-1 text-sm text-slate-600">{eventDetail.venueCity}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Maks tiket per order</p>
              <p class="mt-2 text-base font-medium text-slate-900">{eventDetail.maxTicketsPerOrder}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Mulai event</p>
              <p class="mt-2 text-base font-medium text-slate-900">{formatDate(eventDetail.startAt)}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Selesai event</p>
              <p class="mt-2 text-base font-medium text-slate-900">{formatDate(eventDetail.endAt)}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Mulai jual</p>
              <p class="mt-2 text-base font-medium text-slate-900">{formatDate(eventDetail.saleStartAt)}</p>
            </div>
            <div>
              <p class="text-sm text-slate-500">Selesai jual</p>
              <p class="mt-2 text-base font-medium text-slate-900">{formatDate(eventDetail.saleEndAt)}</p>
            </div>
            <div class="md:col-span-2">
              <p class="text-sm text-slate-500">Alamat venue</p>
              <p class="mt-2 text-base font-medium text-slate-900">
                {eventDetail.venueAddress ?? 'Alamat venue belum diisi.'}
              </p>
            </div>
            <div class="md:col-span-2">
              <p class="text-sm text-slate-500">Deskripsi</p>
              <p class="mt-2 text-sm leading-7 text-slate-700">
                {eventDetail.description ?? 'Deskripsi event belum tersedia.'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Aksi admin"
        description="Gunakan aksi berikut untuk mengarahkan status event sesuai hasil review."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-3">
          {#each statusActions as action (action.status)}
            <button
              type="button"
              class="w-full rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-white"
              onclick={() => requestStatusChange(action.status)}
              disabled={action.status === eventDetail.status}
            >
              <div class="flex items-center justify-between gap-3">
                <p class="font-semibold text-slate-950">{action.label}</p>
                <Badge variant={getStatusVariant(action.status)}>
                  {formatEventStatus(action.status)}
                </Badge>
              </div>
              <p class="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
            </button>
          {/each}
        </div>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card
        title="Seller"
        description="Kontak PIC dan status verifikasi seller pemilik event ini."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-5">
          <div>
            <p class="text-sm text-slate-500">Organisasi</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">{eventDetail.seller.orgName}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">PIC</p>
            <p class="mt-2 text-base font-medium text-slate-900">{eventDetail.seller.fullName}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Email</p>
            <p class="mt-2 text-base font-medium text-slate-900">{eventDetail.seller.email}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Phone</p>
            <p class="mt-2 text-base font-medium text-slate-900">{eventDetail.seller.phone ?? ' - '}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Verifikasi</p>
            <div class="mt-3">
              <Badge variant={eventDetail.seller.isVerified ? 'success' : 'warning'}>
                {eventDetail.seller.isVerified ? 'Verified' : 'Pending'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card
        title="Kategori dan galeri"
        description="Konteks tambahan untuk menilai positioning event dan kualitas materi visual."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-6">
          <div>
            <p class="text-sm text-slate-500">Kategori</p>
            <div class="mt-3 flex flex-wrap gap-2">
              {#if eventDetail.categories.length > 0}
                {#each eventDetail.categories as category (category.id)}
                  <Badge variant="default">{category.name}</Badge>
                {/each}
              {:else}
                <p class="text-sm text-slate-500">Belum ada kategori terpasang.</p>
              {/if}
            </div>
          </div>

          <div>
            <p class="text-sm text-slate-500">Galeri event</p>
            {#if eventDetail.images.length > 0}
              <div class="mt-3 grid gap-3 sm:grid-cols-2">
                {#each eventDetail.images as image (image.id)}
                  <img
                    src={image.imageUrl}
                    alt={`${eventDetail.title} gallery ${image.sortOrder + 1}`}
                    class="h-36 w-full rounded-[1.25rem] object-cover"
                  />
                {/each}
              </div>
            {:else}
              <p class="mt-3 text-sm text-slate-500">Belum ada galeri tambahan.</p>
            {/if}
          </div>
        </div>
      </Card>
    </div>

    <Card
      title="Tier tiket"
      description="Pantau quota, harga, dan penjualan per tier untuk memastikan inventory konsisten."
      class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
    >
      <div class="mb-5 grid gap-4 md:grid-cols-3">
        <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4">
          <p class="text-sm text-slate-500">Total quota</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950">{totalQuota}</p>
        </div>
        <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4">
          <p class="text-sm text-slate-500">Confirmed order</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950">{eventDetail.stats.confirmedOrderCount}</p>
        </div>
        <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4">
          <p class="text-sm text-slate-500">Featured</p>
          <p class="mt-2 text-2xl font-semibold text-slate-950">{eventDetail.isFeatured ? 'Ya' : 'Tidak'}</p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        {#each eventDetail.tiers as tier (tier.id)}
          <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-5">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-lg font-semibold text-slate-950">{tier.name}</p>
                <p class="mt-1 text-sm text-slate-500">{tier.description ?? 'Tanpa deskripsi tier.'}</p>
              </div>
              <Badge variant={tier.status === 'available' ? 'success' : tier.status === 'sold_out' ? 'warning' : 'neutral'}>
                {formatTierStatus(tier.status)}
              </Badge>
            </div>
            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <p class="text-sm text-slate-500">Harga</p>
                <p class="mt-2 font-medium text-slate-900">{formatCurrency(tier.price)}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">Terjual / quota</p>
                <p class="mt-2 font-medium text-slate-900">{tier.soldCount} / {tier.quota}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">Mulai jual tier</p>
                <p class="mt-2 font-medium text-slate-900">{formatDate(tier.saleStartAt)}</p>
              </div>
              <div>
                <p class="text-sm text-slate-500">Selesai jual tier</p>
                <p class="mt-2 font-medium text-slate-900">{formatDate(tier.saleEndAt)}</p>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}

  <Modal
    open={isConfirmOpen}
    title="Ubah status event"
    description="Perubahan ini akan langsung memengaruhi visibilitas event dan notifikasi seller."
    onClose={() => {
      isConfirmOpen = false;
      pendingStatus = null;
    }}
    contentClass="max-w-xl"
  >
    <div class="space-y-6">
      <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-700">
        Anda akan mengubah status <span class="font-semibold">{eventDetail?.title}</span> menjadi
        <span class="font-semibold"> {pendingStatus ? formatEventStatus(pendingStatus) : '-'}</span>.
      </div>

      <div class="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          onclick={() => {
            isConfirmOpen = false;
            pendingStatus = null;
          }}
        >
          <CircleX class="mr-2 size-4" />
          Batal
        </Button>
        <Button type="button" onclick={confirmStatusChange} disabled={isSubmitting || !pendingStatus}>
          <BadgeCheck class="mr-2 size-4" />
          Simpan status
        </Button>
      </div>
    </div>
  </Modal>
</section>