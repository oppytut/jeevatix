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
    class="flex flex-col gap-4 rounded-[2rem] border border-border bg-card/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-muted-foreground uppercase">A6</p>
      <h1 class="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Detail seller
      </h1>
      <p class="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
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
        <div class="h-28 animate-pulse rounded-[1.5rem] border border-border bg-muted"></div>
      {/each}
    </div>
  {:else if sellerUser?.sellerProfile}
    <div class="grid gap-4 md:grid-cols-3">
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-border bg-card/90"
      >
        <p class="text-sm text-muted-foreground">Status verifikasi</p>
        <p class="mt-2 text-3xl font-semibold text-foreground">
          {sellerUser.sellerProfile.isVerified ? 'Verified' : 'Pending'}
        </p>
      </Card>
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-border bg-card/90"
      >
        <p class="text-sm text-muted-foreground">Jumlah event</p>
        <p class="mt-2 text-3xl font-semibold text-foreground">
          {sellerUser.sellerProfile.eventCount}
        </p>
      </Card>
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-border bg-card/90"
      >
        <p class="text-sm text-muted-foreground">Order user</p>
        <p class="mt-2 text-3xl font-semibold text-foreground">{sellerUser.orderCount}</p>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <Card
        title="Profil organisasi"
        description="Detail identitas seller dan PIC akun yang akan diverifikasi."
        class="rounded-[2rem] border border-border bg-card/90 shadow-sm"
      >
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <p class="text-sm text-muted-foreground">Organisasi</p>
            <p class="mt-2 text-lg font-semibold text-foreground">
              {sellerUser.sellerProfile.orgName}
            </p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">PIC</p>
            <p class="mt-2 text-lg font-semibold text-foreground">{sellerUser.fullName}</p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Email</p>
            <p class="mt-2 text-base font-medium text-foreground">{sellerUser.email}</p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Phone</p>
            <p class="mt-2 text-base font-medium text-foreground">{sellerUser.phone ?? '—'}</p>
          </div>
          <div class="md:col-span-2">
            <p class="text-sm text-muted-foreground">Deskripsi organisasi</p>
            <p class="mt-2 text-sm leading-7 text-foreground">
              {sellerUser.sellerProfile.orgDescription ?? 'Belum ada deskripsi organisasi.'}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Keputusan verifikasi"
        description="Approve seller ketika seluruh informasi organisasi dan payout sudah tervalidasi."
        class="rounded-[2rem] border border-border bg-card/90 shadow-sm"
      >
        <div class="space-y-4">
          <div class="rounded-[1.5rem] border border-border bg-muted/80 p-4">
            <p class="text-sm text-muted-foreground">Terverifikasi pada</p>
            <p class="mt-2 text-base font-medium text-foreground">
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
        class="rounded-[2rem] border border-border bg-card/90 shadow-sm"
      >
        <div class="space-y-5">
          <div>
            <p class="text-sm text-muted-foreground">Bank</p>
            <p class="mt-2 text-base font-medium text-foreground">
              {sellerUser.sellerProfile.bankName ?? '—'}
            </p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Nomor rekening</p>
            <p class="mt-2 text-base font-medium text-foreground">
              {sellerUser.sellerProfile.bankAccountNumber ?? '—'}
            </p>
          </div>
          <div>
            <p class="text-sm text-muted-foreground">Nama pemilik rekening</p>
            <p class="mt-2 text-base font-medium text-foreground">
              {sellerUser.sellerProfile.bankAccountHolder ?? '—'}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Daftar event seller"
        description="Event terkini yang dimiliki seller ini untuk membantu review kualitas dan kesiapan operasional."
        class="rounded-[2rem] border border-border bg-card/90 shadow-sm"
      >
        <div class="space-y-3">
          {#if sellerUser.sellerProfile.events.length > 0}
            {#each sellerUser.sellerProfile.events as event (event.id)}
              <div class="rounded-[1.5rem] border border-border bg-muted/80 px-4 py-4">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p class="font-semibold text-foreground">{event.title}</p>
                    <p class="text-sm text-muted-foreground">
                      {event.venueCity} • {formatDate(event.startAt)}
                    </p>
                  </div>
                  <span
                    class="rounded-full bg-card px-3 py-1 text-xs font-semibold tracking-[0.18em] text-foreground uppercase"
                    >{formatStatus(event.status)}</span
                  >
                </div>
              </div>
            {/each}
          {:else}
            <div
              class="rounded-[1.5rem] border border-dashed border-border bg-muted px-4 py-6 text-sm text-muted-foreground"
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
