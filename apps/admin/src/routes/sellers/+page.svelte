<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { BadgeCheck, RefreshCw, Search, Store } from '@lucide/svelte';
  import { Button, Card, DataTable, Input, Toast } from '@jeevatix/ui';

  import { apiGet, ApiError } from '$lib/api';

  type AdminSellerListItem = {
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

  type PaginationMeta = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  type SellersResponse = {
    data: AdminSellerListItem[];
    meta: PaginationMeta;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const columns = [
    { key: 'orgName', header: 'Nama Organisasi' },
    { key: 'email', header: 'Email' },
    { key: 'verificationLabel', header: 'Status Verifikasi' },
    { key: 'eventCount', header: 'Jumlah Event', align: 'right' as const },
    { key: 'createdLabel', header: 'Terdaftar' },
  ];

  const verificationOptions = [
    { value: 'all', label: 'Semua seller' },
    { value: 'true', label: 'Verified' },
    { value: 'false', label: 'Pending' },
  ] as const;

  let sellers = $state<AdminSellerListItem[]>([]);
  let meta = $state<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  let search = $state('');
  let searchDraft = $state('');
  let verificationFilter = $state<(typeof verificationOptions)[number]['value']>('all');
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

    if (verificationFilter !== 'all') {
      params.set('is_verified', verificationFilter);
    }

    return params.toString();
  }

  async function loadSellers(page = meta.page, showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const result = await apiGet<SellersResponse>(`/admin/sellers?${getQueryString(page)}`);
      sellers = result.data;
      meta = result.meta;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Gagal memuat daftar seller.';
      pageError = message;
      setToast({ title: 'Gagal memuat seller', description: message, variant: 'warning' });
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function applyFilters() {
    search = searchDraft.trim();
    void loadSellers(1, true);
  }

  function openSellerDetail(row: Record<string, unknown>) {
    const seller = row as AdminSellerListItem;
    void goto(resolve(`/sellers/${seller.userId}`));
  }

  function previousPage() {
    if (meta.page > 1) {
      void loadSellers(meta.page - 1, true);
    }
  }

  function nextPage() {
    if (meta.totalPages > meta.page) {
      void loadSellers(meta.page + 1, true);
    }
  }

  const tableRows = $derived(
    sellers.map((seller) => ({
      ...seller,
      verificationLabel: seller.isVerified ? 'Verified' : 'Pending',
      createdLabel: formatDate(seller.createdAt),
    })),
  );

  onMount(async () => {
    await loadSellers();
  });
</script>

<svelte:head>
  <title>Sellers | Jeevatix Admin</title>
  <meta
    name="description"
    content="Tinjau seller, status verifikasi organisasi, dan jumlah event yang dikelola di portal admin Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-5 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A5</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Daftar seller
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Review seller yang menunggu approval atau seller aktif yang sudah mengelola event di
        platform.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        type="button"
        onclick={() => loadSellers(meta.page, true)}
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
          <p class="text-sm text-slate-500">Total seller</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{meta.total}</p>
        </div>
        <div class="bg-jeevatix-50 text-jeevatix-700 rounded-2xl p-3">
          <Store class="size-6" />
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
          <p class="text-sm text-slate-500">Verified di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">
            {sellers.filter((seller) => seller.isVerified).length}
          </p>
        </div>
        <div class="bg-sea-50 text-sea-700 rounded-2xl p-3">
          <BadgeCheck class="size-6" />
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
          <p class="text-sm text-slate-500">Menunggu verifikasi</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">
            {sellers.filter((seller) => !seller.isVerified).length}
          </p>
        </div>
        <div class="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Search class="size-6" />
        </div>
      </div>
    </Card>
  </div>

  <Card
    title="Filter seller"
    description="Saring seller terverifikasi atau yang masih menunggu approval, lalu cari organisasi tertentu."
    class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
  >
    <form
      class="grid gap-4 lg:grid-cols-[1.7fr_1fr_auto]"
      onsubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
    >
      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="seller-search">Cari seller</label>
        <Input
          id="seller-search"
          bind:value={searchDraft}
          placeholder="Nama organisasi, email, atau nama PIC seller"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="seller-verification-filter"
          >Verifikasi</label
        >
        <select
          id="seller-verification-filter"
          bind:value={verificationFilter}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
        >
          {#each verificationOptions as option (option.value)}
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
    title="Semua seller"
    description="Klik baris seller untuk membuka halaman review organisasi dan verifikasi."
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
        emptyMessage="Tidak ada seller yang cocok dengan filter saat ini."
        onRowClick={openSellerDetail}
      />
    {/if}

    <div slot="footer" class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-slate-500">
        Menampilkan <span class="font-semibold text-slate-900">{sellers.length}</span> dari {meta.total}
        seller.
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
  </Card>
</section>
