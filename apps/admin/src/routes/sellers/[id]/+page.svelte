<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';
  import { onMount } from 'svelte';
  import { ArrowLeft, BadgeCheck, OctagonX, RefreshCw } from '@lucide/svelte';
  import { Button, Card, Modal, Toast } from '@jeevatix/ui';

  import { apiGet, apiPatch, ApiError } from '$lib/api';

  type UserRole = 'buyer' | 'seller' | 'admin';
  type UserStatus = 'active' | 'suspended' | 'banned';
  type EventStatus =
    | 'draft'
    | 'pending_review'
    | 'published'
    | 'rejected'
    | 'ongoing'
    | 'completed'
    | 'cancelled';

  type SellerEventSummary = {
    id: string;
    title: string;
    slug: string;
    status: EventStatus;
    venueCity: string;
    startAt: string;
  };

  type SellerProfile = {
    id: string;
    orgName: string;
    orgDescription: string | null;
    logoUrl: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankAccountHolder: string | null;
    isVerified: boolean;
    verifiedAt: string | null;
    verifiedBy: string | null;
    eventCount: number;
    events: SellerEventSummary[];
    createdAt: string;
    updatedAt: string;
  };

  type UserDetail = {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    avatarUrl: string | null;
    role: UserRole;
    status: UserStatus;
    emailVerifiedAt: string | null;
    orderCount: number;
    ticketCount: number;
    sellerProfile: SellerProfile | null;
    createdAt: string;
    updatedAt: string;
  };

  type VerifySellerResponse = {
    id: string;
    userId: string;
    email: string;
    fullName: string;
    phone: string | null;
    avatarUrl: string | null;
    orgName: string;
    isVerified: boolean;
    verifiedAt: string | null;
    verifiedBy: string | null;
    eventCount: number;
    createdAt: string;
    updatedAt: string;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  let { params }: PageProps = $props();

  let sellerUser = $state<UserDetail | null>(null);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let isSubmitting = $state(false);
  let pageError = $state('');
  let toast = $state<ToastState | null>(null);
  let pendingVerification = $state<boolean | null>(null);
  let isConfirmOpen = $state(false);

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3500);
  }

  function formatDate(value: string | null) {
    if (!value) {
      return '—';
    }

    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function formatStatus(status: EventStatus) {
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

  async function loadSellerDetail(showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const result = await apiGet<UserDetail>(`/admin/users/${params.id}`);

      if (result.role !== 'seller' || !result.sellerProfile) {
        throw new ApiError('Seller profile tidak ditemukan.', 404, 'SELLER_NOT_FOUND');
      }

      sellerUser = result;
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat detail seller.';
      sellerUser = null;
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function requestVerification(nextVerification: boolean) {
    pendingVerification = nextVerification;
    isConfirmOpen = true;
  }

  async function confirmVerification() {
    if (!sellerUser?.sellerProfile || pendingVerification === null || isSubmitting) {
      return;
    }

    isSubmitting = true;

    try {
      const updatedSeller = await apiPatch<VerifySellerResponse>(
        `/admin/sellers/${sellerUser.sellerProfile.id}/verify`,
        {
          is_verified: pendingVerification,
        },
      );

      sellerUser = {
        ...sellerUser,
        sellerProfile: {
          ...sellerUser.sellerProfile,
          isVerified: updatedSeller.isVerified,
          verifiedAt: updatedSeller.verifiedAt,
          verifiedBy: updatedSeller.verifiedBy,
          eventCount: updatedSeller.eventCount,
          updatedAt: updatedSeller.updatedAt,
        },
      };

      isConfirmOpen = false;
      setToast({
        title: updatedSeller.isVerified ? 'Seller diverifikasi' : 'Seller ditolak',
        description: updatedSeller.isVerified
          ? `${updatedSeller.orgName} kini berstatus verified.`
          : `${updatedSeller.orgName} dikembalikan ke status pending/rejected.`,
        variant: 'success',
      });
    } catch (error) {
      setToast({
        title: 'Gagal mengubah verifikasi',
        description:
          error instanceof ApiError ? error.message : 'Perubahan verifikasi gagal disimpan.',
        variant: 'warning',
      });
    } finally {
      isSubmitting = false;
      pendingVerification = null;
    }
  }

  onMount(async () => {
    await loadSellerDetail();
  });
</script>

<svelte:head>
  <title>Seller Detail | Jeevatix Admin</title>
  <meta
    name="description"
    content="Review detail organisasi seller, data bank, dan daftar event sebelum approve atau reject verifikasi."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-4 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A6</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Detail seller
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Verifikasi organisasi seller, audit data bank, dan review event yang sedang mereka kelola.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" type="button" onclick={() => goto(resolve('/sellers'))}>
        <ArrowLeft class="mr-2 size-4" />
        Kembali ke daftar
      </Button>
      <Button
        variant="outline"
        type="button"
        onclick={() => loadSellerDetail(true)}
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
  {:else if sellerUser?.sellerProfile}
    <div class="grid gap-4 md:grid-cols-3">
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
      >
        <p class="text-sm text-slate-500">Status verifikasi</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">
          {sellerUser.sellerProfile.isVerified ? 'Verified' : 'Pending'}
        </p>
      </Card>
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
      >
        <p class="text-sm text-slate-500">Jumlah event</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">
          {sellerUser.sellerProfile.eventCount}
        </p>
      </Card>
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
      >
        <p class="text-sm text-slate-500">Order user</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">{sellerUser.orderCount}</p>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card
        title="Profil organisasi"
        description="Detail identitas seller dan PIC akun yang akan diverifikasi."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <p class="text-sm text-slate-500">Organisasi</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">
              {sellerUser.sellerProfile.orgName}
            </p>
          </div>
          <div>
            <p class="text-sm text-slate-500">PIC</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">{sellerUser.fullName}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Email</p>
            <p class="mt-2 text-base font-medium text-slate-900">{sellerUser.email}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Phone</p>
            <p class="mt-2 text-base font-medium text-slate-900">{sellerUser.phone ?? '—'}</p>
          </div>
          <div class="md:col-span-2">
            <p class="text-sm text-slate-500">Deskripsi organisasi</p>
            <p class="mt-2 text-sm leading-7 text-slate-700">
              {sellerUser.sellerProfile.orgDescription ?? 'Belum ada deskripsi organisasi.'}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Keputusan verifikasi"
        description="Approve seller ketika seluruh informasi organisasi dan payout sudah tervalidasi."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-4">
          <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4">
            <p class="text-sm text-slate-500">Terverifikasi pada</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {formatDate(sellerUser.sellerProfile.verifiedAt)}
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              onclick={() => requestVerification(true)}
              disabled={sellerUser.sellerProfile.isVerified}
            >
              <BadgeCheck class="mr-2 size-4" />
              Verify
            </Button>
            <Button variant="outline" type="button" onclick={() => requestVerification(false)}>
              <OctagonX class="mr-2 size-4" />
              Reject
            </Button>
          </div>
        </div>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <Card
        title="Data bank"
        description="Pastikan data payout seller lengkap dan sesuai sebelum approval."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-5">
          <div>
            <p class="text-sm text-slate-500">Bank</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {sellerUser.sellerProfile.bankName ?? '—'}
            </p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Nomor rekening</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {sellerUser.sellerProfile.bankAccountNumber ?? '—'}
            </p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Nama pemilik rekening</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {sellerUser.sellerProfile.bankAccountHolder ?? '—'}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Daftar event seller"
        description="Event terkini yang dimiliki seller ini untuk membantu review kualitas dan kesiapan operasional."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-3">
          {#if sellerUser.sellerProfile.events.length > 0}
            {#each sellerUser.sellerProfile.events as event (event.id)}
              <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="font-semibold text-slate-950">{event.title}</p>
                    <p class="text-sm text-slate-600">
                      {event.venueCity} • {formatDate(event.startAt)}
                    </p>
                  </div>
                  <span
                    class="rounded-full bg-white px-3 py-1 text-xs font-semibold tracking-[0.18em] text-slate-700 uppercase"
                    >{formatStatus(event.status)}</span
                  >
                </div>
              </div>
            {/each}
          {:else}
            <div
              class="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500"
            >
              Seller ini belum memiliki event terdaftar.
            </div>
          {/if}
        </div>
      </Card>
    </div>
  {/if}

  <Modal
    open={isConfirmOpen}
    title="Konfirmasi verifikasi seller"
    description="Pastikan keputusan verifikasi ini sesuai dengan hasil review organisasi dan data payout seller."
    onClose={() => {
      isConfirmOpen = false;
      pendingVerification = null;
    }}
    contentClass="max-w-xl"
  >
    <div class="space-y-6">
      <div
        class={`rounded-[1.5rem] border p-4 text-sm leading-6 ${pendingVerification ? 'border-sea-200 bg-sea-50 text-sea-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}
      >
        {#if pendingVerification}
          Anda akan memverifikasi seller <span class="font-semibold"
            >{sellerUser?.sellerProfile?.orgName}</span
          >.
        {:else}
          Anda akan menolak atau membatalkan verifikasi seller <span class="font-semibold"
            >{sellerUser?.sellerProfile?.orgName}</span
          >.
        {/if}
      </div>

      <div class="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          onclick={() => {
            isConfirmOpen = false;
            pendingVerification = null;
          }}
        >
          Batal
        </Button>
        <Button type="button" onclick={confirmVerification} disabled={isSubmitting}>
          Simpan Keputusan
        </Button>
      </div>
    </div>
  </Modal>
</section>
