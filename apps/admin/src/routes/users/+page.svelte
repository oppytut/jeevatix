<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { RefreshCw, Search, ShieldBan, UserRound } from '@lucide/svelte';
  import { Button, Card, DataTable, Input, Select, Toast } from '@jeevatix/ui';

  import { apiGetEnvelope, ApiError } from '$lib/api';

  type UserRole = 'buyer' | 'seller' | 'admin';
  type UserStatus = 'active' | 'suspended' | 'banned';

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
    { key: 'fullName', header: 'Nama' },
    { key: 'email', header: 'Email' },
    { key: 'roleLabel', header: 'Role' },
    { key: 'statusLabel', header: 'Status' },
    { key: 'sellerLabel', header: 'Seller' },
    { key: 'joinedLabel', header: 'Terdaftar' },
  ];

  const roleOptions = [
    { value: 'all', label: 'Semua role' },
    { value: 'buyer', label: 'Buyer' },
    { value: 'seller', label: 'Seller' },
    { value: 'admin', label: 'Admin' },
  ] as const;

  const statusOptions = [
    { value: 'all', label: 'Semua status' },
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'banned', label: 'Banned' },
  ] as const;

  let users = $state<AdminUserListItem[]>([]);
  let meta = $state<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  let search = $state('');
  let searchDraft = $state('');
  let roleFilter = $state<(typeof roleOptions)[number]['value']>('all');
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

  function formatRole(role: UserRole) {
    return role === 'admin' ? 'Admin' : role === 'seller' ? 'Seller' : 'Buyer';
  }

  function formatStatus(status: UserStatus) {
    return status === 'active' ? 'Active' : status === 'suspended' ? 'Suspended' : 'Banned';
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  function getQueryString(page = meta.page) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(meta.limit),
    });

    if (search) {
      params.set('search', search);
    }

    if (roleFilter !== 'all') {
      params.set('role', roleFilter);
    }

    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }

    return params.toString();
  }

  async function loadUsers(page = meta.page, showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const result = await apiGetEnvelope<AdminUserListItem[], PaginationMeta>(
        `/admin/users?${getQueryString(page)}`,
      );

      users = result.data;
      meta = result.meta ?? meta;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Gagal memuat daftar user.';
      pageError = message;
      setToast({ title: 'Gagal memuat user', description: message, variant: 'warning' });
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function applyFilters() {
    search = searchDraft.trim();
    void loadUsers(1, true);
  }

  function openUserDetail(user: Record<string, unknown>) {
    const nextUser = user as AdminUserListItem;
    void goto(resolve(`/users/${nextUser.id}`));
  }

  function previousPage() {
    if (meta.page > 1) {
      void loadUsers(meta.page - 1, true);
    }
  }

  function nextPage() {
    if (meta.totalPages > meta.page) {
      void loadUsers(meta.page + 1, true);
    }
  }

  const tableRows = $derived(
    users.map((user) => ({
      ...user,
      roleLabel: formatRole(user.role),
      statusLabel: formatStatus(user.status),
      sellerLabel:
        user.role === 'seller'
          ? `${user.sellerOrgName ?? 'Seller profile'}${user.sellerVerified ? ' • Verified' : ' • Pending'}`
          : '—',
      joinedLabel: formatDate(user.createdAt),
    })),
  );

  onMount(async () => {
    await loadUsers();
  });
</script>

<svelte:head>
  <title>Users | Jeevatix Admin</title>
  <meta
    name="description"
    content="Pantau seluruh akun buyer, seller, dan admin di portal admin Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="border-border bg-card/85 flex flex-col gap-5 rounded-[2rem] border p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-muted-foreground text-sm font-semibold tracking-[0.32em] uppercase">A3</p>
      <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">Daftar user</h1>
      <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
        Monitor akun buyer, seller, dan admin dengan filter role, status, serta pencarian cepat.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        type="button"
        onclick={() => loadUsers(meta.page, true)}
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
          <p class="text-muted-foreground text-sm">Total akun</p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{meta.total}</p>
        </div>
        <div class="bg-jeevatix-50 text-jeevatix-700 rounded-2xl p-3">
          <UserRound class="size-6" />
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
          <p class="text-muted-foreground text-sm">Seller aktif di hasil</p>
          <p class="text-foreground mt-2 text-3xl font-semibold">
            {users.filter((user) => user.role === 'seller').length}
          </p>
        </div>
        <div class="bg-sea-50 text-sea-700 rounded-2xl p-3">
          <ShieldBan class="size-6" />
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
          <p class="text-muted-foreground text-sm">Halaman aktif</p>
          <p class="text-foreground mt-2 text-3xl font-semibold">{meta.page}</p>
        </div>
        <div class="bg-muted text-foreground rounded-2xl p-3">
          <Search class="size-6" />
        </div>
      </div>
    </Card>
  </div>

  <Card
    title="Filter user"
    description="Gabungkan search, role, dan status untuk menyorot akun yang perlu ditinjau."
    class="border-border bg-card/90 rounded-[2rem] border shadow-sm"
  >
    <form
      class="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr_auto]"
      onsubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
    >
      <div class="space-y-2">
        <label class="text-foreground text-sm font-medium" for="user-search">Cari user</label>
        <Input
          id="user-search"
          bind:value={searchDraft}
          placeholder="Nama lengkap, email, atau nama organisasi seller"
        />
      </div>

      <div class="space-y-2">
        <label class="text-foreground text-sm font-medium" for="user-role-filter">Role</label>
        <Select
          id="user-role-filter"
          bind:value={roleFilter}
          class="h-11 rounded-full"
        >
          {#each roleOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </Select>
      </div>

      <div class="space-y-2">
        <label class="text-foreground text-sm font-medium" for="user-status-filter">Status</label>
        <Select
          id="user-status-filter"
          bind:value={statusFilter}
          class="h-11 rounded-full"
        >
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
    title="Semua user"
    description="Klik baris untuk membuka detail profil dan aksi status akun."
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
        emptyMessage="Tidak ada user yang cocok dengan filter saat ini."
        onRowClick={openUserDetail}
      />
    {/if}

    {#snippet footer()}
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-muted-foreground text-sm">
          Menampilkan <span class="text-foreground font-semibold">{users.length}</span> dari {meta.total}
          akun.
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
