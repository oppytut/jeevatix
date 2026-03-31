<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { ArrowLeft, Pencil, Plus, RefreshCw, Save, Ticket, Trash2 } from '@lucide/svelte';
  import { Badge, Button, Card, DataTable, Input, Toast } from '@jeevatix/ui';

  import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '$lib/api';

  type SellerTier = {
    id: string;
    event_id: string;
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
  };

  type SellerEventDetail = {
    id: string;
    title: string;
    status: string;
    total_sold: number;
    total_quota: number;
  };

  type TierFormState = {
    name: string;
    description: string;
    price: string;
    quota: string;
    sort_order: string;
    sale_start_at: string;
    sale_end_at: string;
    status: 'available' | 'sold_out' | 'hidden';
  };

  type TableRow = {
    id: string;
    name: string;
    price: string;
    quota: string;
    status: SellerTier['status'];
    sales: string;
    original: SellerTier;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const columns = [
    { key: 'name', header: 'Tier' },
    { key: 'price', header: 'Harga' },
    { key: 'quota', header: 'Quota', align: 'right' as const },
    { key: 'sales', header: 'Sold', align: 'right' as const },
    { key: 'status', header: 'Status' },
  ];

  const eventId = $derived(page.params.id);

  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let isSubmitting = $state(false);
  let isDeletingTierId = $state<string | null>(null);
  let pageError = $state('');
  let formError = $state('');
  let toast = $state<ToastState | null>(null);
  let eventDetail = $state<SellerEventDetail | null>(null);
  let tiers = $state<SellerTier[]>([]);
  let editingTierId = $state<string | null>(null);
  let form = $state<TierFormState>({
    name: '',
    description: '',
    price: '',
    quota: '',
    sort_order: '0',
    sale_start_at: '',
    sale_end_at: '',
    status: 'available',
  });

  const tableRows = $derived<TableRow[]>(
    tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      price: `Rp ${tier.price.toLocaleString('id-ID')}`,
      quota: tier.quota.toString(),
      sales: `${tier.sold_count}/${tier.quota}`,
      status: tier.status,
      original: tier,
    })),
  );

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3600);
  }

  function toDateTimeLocal(value: string | null) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
  }

  function toIsoString(value: string) {
    return new Date(value).toISOString();
  }

  function resetForm() {
    editingTierId = null;
    form = {
      name: '',
      description: '',
      price: '',
      quota: '',
      sort_order: tiers.length.toString(),
      sale_start_at: '',
      sale_end_at: '',
      status: 'available',
    };
    formError = '';
  }

  function populateFormFromTier(tier: SellerTier) {
    editingTierId = tier.id;
    form = {
      name: tier.name,
      description: tier.description ?? '',
      price: tier.price.toString(),
      quota: tier.quota.toString(),
      sort_order: tier.sort_order.toString(),
      sale_start_at: toDateTimeLocal(tier.sale_start_at),
      sale_end_at: toDateTimeLocal(tier.sale_end_at),
      status: tier.status,
    };
    formError = '';
  }

  function getStatusBadgeVariant(status: SellerTier['status']) {
    switch (status) {
      case 'available':
        return 'success';
      case 'sold_out':
        return 'warning';
      case 'hidden':
        return 'neutral';
    }
  }

  async function loadPage(showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const [detail, tierList] = await Promise.all([
        apiGet<SellerEventDetail>(`/seller/events/${eventId}`),
        apiGet<SellerTier[]>(`/seller/events/${eventId}/tiers`),
      ]);
      eventDetail = detail;
      tiers = tierList;
      if (!editingTierId) {
        resetForm();
      }
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat data tier event.';
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  async function submitForm(event: SubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!form.name.trim() || !form.price || !form.quota) {
      formError = 'Nama, harga, dan quota tier wajib diisi.';
      return;
    }

    isSubmitting = true;
    formError = '';

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: Number(form.price),
      quota: Number(form.quota),
      sort_order: Number(form.sort_order || 0),
      sale_start_at: form.sale_start_at ? toIsoString(form.sale_start_at) : undefined,
      sale_end_at: form.sale_end_at ? toIsoString(form.sale_end_at) : undefined,
      status: form.status,
    };

    try {
      if (editingTierId) {
        await apiPatch<SellerTier>(`/seller/events/${eventId}/tiers/${editingTierId}`, payload);
        setToast({
          title: 'Tier diperbarui',
          description: 'Perubahan tier tiket berhasil disimpan.',
          variant: 'success',
        });
      } else {
        await apiPost<SellerTier>(`/seller/events/${eventId}/tiers`, payload);
        setToast({
          title: 'Tier ditambahkan',
          description: 'Tier tiket baru berhasil dibuat untuk event ini.',
          variant: 'success',
        });
      }

      resetForm();
      await loadPage(true);
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal menyimpan tier tiket.';
    } finally {
      isSubmitting = false;
    }
  }

  async function deleteTier(tier: SellerTier) {
    if (tier.sold_count > 0 || isDeletingTierId || !window.confirm(`Hapus tier \"${tier.name}\"?`)) {
      return;
    }

    isDeletingTierId = tier.id;

    try {
      await apiDelete<{ message: string }>(`/seller/events/${eventId}/tiers/${tier.id}`);
      setToast({
        title: 'Tier dihapus',
        description: `${tier.name} berhasil dihapus dari event ini.`,
        variant: 'success',
      });
      if (editingTierId === tier.id) {
        resetForm();
      }
      await loadPage(true);
    } catch (error) {
      setToast({
        title: 'Gagal menghapus tier',
        description: error instanceof ApiError ? error.message : 'Tier tidak dapat dihapus saat ini.',
        variant: 'warning',
      });
    } finally {
      isDeletingTierId = null;
    }
  }

  onMount(async () => {
    await loadPage();
  });
</script>

<svelte:head>
  <title>Seller Tier Management | Jeevatix</title>
  <meta
    name="description"
    content="Kelola seluruh tier tiket per event seller, termasuk create, update, dan hapus sesuai batasan penjualan."
  />
</svelte:head>

<section class="space-y-8">
  {#if toast}
    <Toast title={toast.title} description={toast.description} variant={toast.variant} actionLabel={undefined} />
  {/if}

  {#if pageError}
    <Toast title="Gagal memuat tier" description={pageError} variant="warning" actionLabel={undefined} />
  {/if}

  <div class="rounded-[2rem] border border-slate-200/80 bg-white/92 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">S10</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Kelola tier tiket</h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Buat, edit, dan evaluasi tier tiket event seller. Penghapusan otomatis diblok jika tier sudah punya penjualan.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button variant="outline" type="button" onclick={() => loadPage(true)} disabled={isRefreshing || isLoading}>
          <RefreshCw class={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" type="button" onclick={() => goto(resolve(`/events/${eventId}`))}>
          <ArrowLeft class="mr-2 size-4" />
          Kembali ke Detail
        </Button>
      </div>
    </div>
  </div>

  {#if isLoading}
    <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div class="h-[520px] animate-pulse rounded-[2rem] border border-slate-200 bg-slate-100"></div>
      <div class="h-[520px] animate-pulse rounded-[2rem] border border-slate-200 bg-slate-100"></div>
    </div>
  {:else}
    <div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card
        title={eventDetail ? `${eventDetail.title} — Tier Table` : 'Tier Table'}
        description="Tabel operasional semua tier tiket untuk event ini."
        class="rounded-[2rem] border border-slate-200/80 bg-white/95"
      >
        <div class="mb-5 grid gap-4 md:grid-cols-3">
          <div class="rounded-[1.3rem] border border-slate-200 bg-slate-50/70 p-4">
            <p class="text-sm text-slate-500">Total Tier</p>
            <p class="mt-3 text-2xl font-semibold text-slate-950">{tiers.length}</p>
          </div>
          <div class="rounded-[1.3rem] border border-slate-200 bg-slate-50/70 p-4">
            <p class="text-sm text-slate-500">Total Sold</p>
            <p class="mt-3 text-2xl font-semibold text-slate-950">{eventDetail?.total_sold ?? 0}</p>
          </div>
          <div class="rounded-[1.3rem] border border-slate-200 bg-slate-50/70 p-4">
            <p class="text-sm text-slate-500">Total Quota</p>
            <p class="mt-3 text-2xl font-semibold text-slate-950">{eventDetail?.total_quota ?? 0}</p>
          </div>
        </div>

        <DataTable
          title={undefined}
          description={undefined}
          {columns}
          rows={tableRows}
          emptyMessage="Belum ada tier tiket. Tambahkan tier pertama dari panel kanan."
          actionHeader="Aksi"
        >
          {#snippet cell(row, column)}
            {@const tier = (row as TableRow).original}
            {#if column.key === 'name'}
              <div class="space-y-1">
                <p class="font-semibold text-slate-950">{tier.name}</p>
                <p class="text-xs text-slate-500">Sort order {tier.sort_order}</p>
              </div>
            {:else if column.key === 'status'}
              <Badge variant={getStatusBadgeVariant(tier.status)}>{tier.status}</Badge>
            {:else if column.key === 'sales'}
              <div class="space-y-2 text-right">
                <p class="font-semibold text-slate-950">{tier.sold_count}/{tier.quota}</p>
                <div class="ml-auto h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full rounded-full bg-jeevatix-600" style={`width: ${tier.quota === 0 ? 0 : Math.min(100, (tier.sold_count / tier.quota) * 100)}%`}></div>
                </div>
              </div>
            {:else}
              —
            {/if}
          {/snippet}

          {#snippet rowActions(row)}
            {@const tier = (row as TableRow).original}
            <div class="flex justify-end gap-2">
              <Button size="sm" variant="outline" type="button" onclick={() => populateFormFromTier(tier)}>
                <Pencil class="mr-2 size-3.5" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                type="button"
                class="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                disabled={tier.sold_count > 0 || isDeletingTierId === tier.id}
                onclick={() => deleteTier(tier)}
              >
                <Trash2 class="mr-2 size-3.5" />
                Hapus
              </Button>
            </div>
          {/snippet}
        </DataTable>
      </Card>

      <Card
        title={editingTierId ? 'Edit tier tiket' : 'Tambah tier tiket'}
        description={editingTierId ? 'Perbarui harga, quota, atau status tier.' : 'Buat tier baru untuk event ini.'}
        class="rounded-[2rem] border border-slate-200/80 bg-white/95"
      >
        {#if formError}
          <div class="mb-4 rounded-[1.25rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {formError}
          </div>
        {/if}

        <form class="space-y-4" onsubmit={submitForm}>
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700" for="tier-name">Nama Tier</label>
            <Input id="tier-name" bind:value={form.name} placeholder="VIP Early Bird" required />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700" for="tier-description">Deskripsi</label>
            <textarea
              id="tier-description"
              bind:value={form.description}
              class="min-h-28 w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="Benefit untuk tier ini."
            ></textarea>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="tier-price">Harga</label>
              <Input id="tier-price" type="number" min="0" bind:value={form.price} required />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="tier-quota">Quota</label>
              <Input id="tier-quota" type="number" min="1" bind:value={form.quota} required />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="tier-sort">Sort Order</label>
              <Input id="tier-sort" type="number" min="0" bind:value={form.sort_order} />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="tier-status">Status</label>
              <select
                id="tier-status"
                bind:value={form.status}
                class="w-full rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="available">available</option>
                <option value="sold_out">sold_out</option>
                <option value="hidden">hidden</option>
              </select>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="sale-start">Sale Start</label>
              <Input id="sale-start" type="datetime-local" bind:value={form.sale_start_at} />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700" for="sale-end">Sale End</label>
              <Input id="sale-end" type="datetime-local" bind:value={form.sale_end_at} />
            </div>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" type="button" onclick={resetForm}>
              <Plus class="mr-2 size-4" />
              Reset Form
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save class="mr-2 size-4" />
              {editingTierId ? 'Simpan Perubahan' : 'Tambah Tier'}
            </Button>
          </div>
        </form>

        <div class="mt-6 rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-600">
          Tier dengan `sold_count > 0` tidak bisa dihapus. Backend juga mengunci perubahan harga jika tiket sudah terjual.
        </div>
      </Card>
    </div>
  {/if}
</section>