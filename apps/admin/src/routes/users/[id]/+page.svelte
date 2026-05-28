<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';
  import { onMount } from 'svelte';
  import { ArrowLeft, Ban, CircleCheckBig, PauseCircle, RefreshCw } from '@lucide/svelte';
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

  type AdminUserListItem = {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    avatarUrl: string | null;
    role: UserRole;
    status: UserStatus;
    emailVerifiedAt: string | null;
    sellerProfileId: string | null;
    sellerOrgName: string | null;
    sellerVerified: boolean | null;
    createdAt: string;
    updatedAt: string;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const statusActions: { status: UserStatus; label: string; description: string }[] = [
    {
      status: 'active',
      label: 'Activate',
      description: 'Pulihkan akses login dan transaksi user ini.',
    },
    {
      status: 'suspended',
      label: 'Suspend',
      description: 'Nonaktifkan sementara akun tanpa menghapus histori data.',
    },
    {
      status: 'banned',
      label: 'Ban',
      description: 'Blokir akun secara penuh dari akses platform.',
    },
  ];

  let { params }: PageProps = $props();

  let user = $state<UserDetail | null>(null);
  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let isRefreshing = $state(false);
  let pageError = $state('');
  let toast = $state<ToastState | null>(null);
  let pendingStatus = $state<UserStatus | null>(null);
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

  function formatStatus(status: UserStatus) {
    return status === 'active' ? 'Active' : status === 'suspended' ? 'Suspended' : 'Banned';
  }

  function formatRole(role: UserRole) {
    return role === 'admin' ? 'Admin' : role === 'seller' ? 'Seller' : 'Buyer';
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

  async function loadUserDetail(showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      user = await apiGet<UserDetail>(`/admin/users/${params.id}`);
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat detail user.';
      user = null;
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function requestStatusChange(status: UserStatus) {
    pendingStatus = status;
    isConfirmOpen = true;
  }

  async function confirmStatusChange() {
    if (!user || !pendingStatus || isSubmitting) {
      return;
    }

    isSubmitting = true;

    try {
      const updatedUser = await apiPatch<AdminUserListItem>(`/admin/users/${user.id}/status`, {
        status: pendingStatus,
      });

      user = {
        ...user,
        status: updatedUser.status,
        updatedAt: updatedUser.updatedAt,
      };
      isConfirmOpen = false;
      setToast({
        title: 'Status user diperbarui',
        description: `${user.fullName} sekarang berstatus ${formatStatus(updatedUser.status)}.`,
        variant: 'success',
      });
    } catch (error) {
      setToast({
        title: 'Gagal memperbarui status',
        description:
          error instanceof ApiError ? error.message : 'Aksi status tidak berhasil disimpan.',
        variant: 'warning',
      });
    } finally {
      isSubmitting = false;
      pendingStatus = null;
    }
  }

  onMount(async () => {
    await loadUserDetail();
  });
</script>

<svelte:head>
  <title>User Detail | Jeevatix Admin</title>
  <meta
    name="description"
    content="Review profil user, statistik order dan tiket, serta lakukan perubahan status akun dari admin portal."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="border-border bg-card/85 flex flex-col gap-4 rounded-[2rem] border p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-muted-foreground text-sm font-semibold tracking-[0.32em] uppercase">A4</p>
      <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">Detail user</h1>
      <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
        Review identitas, aktivitas transaksi, dan profil seller sebelum melakukan tindakan status
        akun.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" type="button" onclick={() => goto(resolve('/users'))}>
        <ArrowLeft class="mr-2 size-4" />
        Kembali ke daftar
      </Button>
      <Button
        variant="outline"
        type="button"
        onclick={() => loadUserDetail(true)}
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
        <div class="border-border bg-muted h-28 animate-pulse rounded-[1.5rem] border"></div>
      {/each}
    </div>
  {:else if user}
    <div class="grid gap-4 md:grid-cols-3">
      <Card
        title={undefined}
        description={undefined}
        class="border-border bg-card/90 rounded-[1.75rem] border"
      >
        <p class="text-muted-foreground text-sm">Status akun</p>
        <p class="text-foreground mt-2 text-3xl font-semibold">{formatStatus(user.status)}</p>
      </Card>
      <Card
        title={undefined}
        description={undefined}
        class="border-border bg-card/90 rounded-[1.75rem] border"
      >
        <p class="text-muted-foreground text-sm">Total order</p>
        <p class="text-foreground mt-2 text-3xl font-semibold">{user.orderCount}</p>
      </Card>
      <Card
        title={undefined}
        description={undefined}
        class="border-border bg-card/90 rounded-[1.75rem] border"
      >
        <p class="text-muted-foreground text-sm">Total tiket</p>
        <p class="text-foreground mt-2 text-3xl font-semibold">{user.ticketCount}</p>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card
        title="Profil user"
        description="Identitas akun inti yang digunakan untuk autentikasi dan transaksi."
        class="border-border bg-card/90 rounded-[2rem] border shadow-sm"
      >
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <p class="text-muted-foreground text-sm">Nama lengkap</p>
            <p class="text-foreground mt-2 text-lg font-semibold">{user.fullName}</p>
          </div>
          <div>
            <p class="text-muted-foreground text-sm">Email</p>
            <p class="text-foreground mt-2 text-lg font-semibold">{user.email}</p>
          </div>
          <div>
            <p class="text-muted-foreground text-sm">Role</p>
            <p class="text-foreground mt-2 text-base font-medium">{formatRole(user.role)}</p>
          </div>
          <div>
            <p class="text-muted-foreground text-sm">Phone</p>
            <p class="text-foreground mt-2 text-base font-medium">{user.phone ?? '—'}</p>
          </div>
          <div>
            <p class="text-muted-foreground text-sm">Email verified</p>
            <p class="text-foreground mt-2 text-base font-medium">
              {formatDate(user.emailVerifiedAt)}
            </p>
          </div>
          <div>
            <p class="text-muted-foreground text-sm">Terdaftar</p>
            <p class="text-foreground mt-2 text-base font-medium">{formatDate(user.createdAt)}</p>
          </div>
        </div>
      </Card>

      <Card
        title="Aksi status"
        description="Gunakan aksi ini untuk membatasi, memblokir, atau memulihkan akses akun."
        class="border-border bg-card/90 rounded-[2rem] border shadow-sm"
      >
        <div class="space-y-3">
          {#each statusActions as action (action.status)}
            <div
              class="border-border bg-muted/80 flex items-center justify-between gap-4 rounded-[1.5rem] border px-4 py-4"
            >
              <div class="space-y-1">
                <p class="text-foreground font-semibold">{action.label}</p>
                <p class="text-muted-foreground text-sm leading-6">{action.description}</p>
              </div>
              <Button
                variant={user.status === action.status ? 'secondary' : 'outline'}
                type="button"
                disabled={user.status === action.status}
                onclick={() => requestStatusChange(action.status)}
              >
                {#if action.status === 'active'}
                  <CircleCheckBig class="mr-2 size-4" />
                {:else if action.status === 'suspended'}
                  <PauseCircle class="mr-2 size-4" />
                {:else}
                  <Ban class="mr-2 size-4" />
                {/if}
                {action.label}
              </Button>
            </div>
          {/each}
        </div>
      </Card>
    </div>

    {#if user.sellerProfile}
      <Card
        title="Profil seller"
        description="Informasi organisasi dan event seller yang terkait dengan akun ini."
        class="border-border bg-card/90 rounded-[2rem] border shadow-sm"
      >
        <div class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div class="border-border bg-muted/80 space-y-5 rounded-[1.5rem] border p-5">
            <div>
              <p class="text-muted-foreground text-sm">Organisasi</p>
              <p class="text-foreground mt-2 text-xl font-semibold">{user.sellerProfile.orgName}</p>
            </div>
            <div>
              <p class="text-muted-foreground text-sm">Deskripsi</p>
              <p class="text-foreground mt-2 text-sm leading-6">
                {user.sellerProfile.orgDescription ?? 'Belum ada deskripsi organisasi.'}
              </p>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <p class="text-muted-foreground text-sm">Status verifikasi</p>
                <p class="text-foreground mt-2 text-base font-medium">
                  {user.sellerProfile.isVerified ? 'Verified' : 'Pending'}
                </p>
              </div>
              <div>
                <p class="text-muted-foreground text-sm">Jumlah event</p>
                <p class="text-foreground mt-2 text-base font-medium">
                  {user.sellerProfile.eventCount}
                </p>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div>
              <p class="text-muted-foreground text-sm font-semibold tracking-[0.24em] uppercase">
                Event seller
              </p>
              <div class="mt-3 space-y-3">
                {#if user.sellerProfile.events.length > 0}
                  {#each user.sellerProfile.events as event (event.id)}
                    <div class="border-border bg-card rounded-[1.5rem] border px-4 py-4">
                      <div
                        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p class="text-foreground font-semibold">{event.title}</p>
                          <p class="text-muted-foreground text-sm">
                            {event.venueCity} • {formatDate(event.startAt)}
                          </p>
                        </div>
                        <span
                          class="bg-muted text-foreground rounded-full px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase"
                          >{formatEventStatus(event.status)}</span
                        >
                      </div>
                    </div>
                  {/each}
                {:else}
                  <div
                    class="border-border bg-muted text-muted-foreground rounded-[1.5rem] border border-dashed px-4 py-6 text-sm"
                  >
                    Seller ini belum memiliki event terdaftar.
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>
      </Card>
    {/if}
  {/if}

  <Modal
    open={isConfirmOpen}
    title="Konfirmasi perubahan status"
    description="Pastikan aksi status ini sesuai dengan kebijakan moderasi admin sebelum disimpan."
    onClose={() => {
      isConfirmOpen = false;
      pendingStatus = null;
    }}
    contentClass="max-w-xl"
  >
    <div class="space-y-6">
      <div
        class="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
      >
        Anda akan mengubah status <span class="font-semibold">{user?.fullName}</span> menjadi
        <span class="font-semibold">{pendingStatus ? formatStatus(pendingStatus) : '—'}</span>.
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
          Batal
        </Button>
        <Button type="button" onclick={confirmStatusChange} disabled={isSubmitting}>
          Simpan Status
        </Button>
      </div>
    </div>
  </Modal>
</section>
