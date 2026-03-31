<script lang="ts">
  import { onMount } from 'svelte';
  import { Pencil, Plus, RefreshCw, Trash2 } from '@lucide/svelte';
  import { Button, Card, DataTable, Input, Modal, Toast } from '@jeevatix/ui';

  import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from '$lib/api';

  type Category = {
    id: number;
    name: string;
    slug: string;
    icon: string | null;
    eventCount?: number;
  };

  type CategoryFormState = {
    name: string;
    icon: string;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const columns = [
    { key: 'name', header: 'Nama' },
    { key: 'slug', header: 'Slug' },
    { key: 'icon', header: 'Icon' },
    { key: 'eventCount', header: 'Jumlah Event', align: 'right' as const },
  ];

  let categories = $state<Category[]>([]);
  let isLoading = $state(true);
  let isSubmitting = $state(false);
  let isRefreshing = $state(false);
  let pageError = $state('');
  let formError = $state('');
  let toast = $state<ToastState | null>(null);
  let isFormModalOpen = $state(false);
  let isDeleteModalOpen = $state(false);
  let selectedCategory = $state<Category | null>(null);
  let formMode = $state<'create' | 'edit'>('create');
  let form = $state<CategoryFormState>({
    name: '',
    icon: '',
  });

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3500);
  }

  async function loadCategories(showSpinner = false) {
    pageError = '';

    if (showSpinner) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      categories = await apiGet<Category[]>('/admin/categories');
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat daftar kategori admin.';
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function resetForm() {
    form = {
      name: '',
      icon: '',
    };
    formError = '';
  }

  function openCreateModal() {
    formMode = 'create';
    selectedCategory = null;
    resetForm();
    isFormModalOpen = true;
  }

  function openEditModal(category: Category) {
    formMode = 'edit';
    selectedCategory = category;
    form = {
      name: category.name,
      icon: category.icon ?? '',
    };
    formError = '';
    isFormModalOpen = true;
  }

  function openDeleteModal(category: Category) {
    selectedCategory = category;
    isDeleteModalOpen = true;
  }

  async function submitForm(event: SubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    isSubmitting = true;
    formError = '';

    try {
      if (formMode === 'create') {
        await apiPost<Category>('/admin/categories', {
          name: form.name,
          icon: form.icon || undefined,
        });

        setToast({
          title: 'Kategori ditambahkan',
          description: 'Kategori baru berhasil dibuat.',
          variant: 'success',
        });
      } else if (selectedCategory) {
        await apiPatch<Category>(`/admin/categories/${selectedCategory.id}`, {
          name: form.name,
          icon: form.icon || undefined,
        });

        setToast({
          title: 'Kategori diperbarui',
          description: 'Perubahan kategori berhasil disimpan.',
          variant: 'success',
        });
      }

      isFormModalOpen = false;
      await loadCategories(true);
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal menyimpan kategori.';
    } finally {
      isSubmitting = false;
    }
  }

  async function confirmDelete() {
    if (!selectedCategory || isSubmitting) {
      return;
    }

    isSubmitting = true;

    try {
      await apiDelete<{ message: string }>(`/admin/categories/${selectedCategory.id}`);
      isDeleteModalOpen = false;
      setToast({
        title: 'Kategori dihapus',
        description: `Kategori ${selectedCategory.name} berhasil dihapus.`,
        variant: 'success',
      });
      await loadCategories(true);
    } catch (error) {
      isDeleteModalOpen = false;
      setToast({
        title: 'Gagal menghapus kategori',
        description:
          error instanceof ApiError ? error.message : 'Kategori tidak dapat dihapus saat ini.',
        variant: 'warning',
      });
    } finally {
      isSubmitting = false;
    }
  }

  function editCategory(category: Category) {
    openEditModal(category);
  }

  function requestDeleteCategory(category: Category) {
    openDeleteModal(category);
  }

  onMount(async () => {
    await loadCategories();
  });
</script>

<svelte:head>
  <title>Categories | Jeevatix Admin</title>
  <meta
    name="description"
    content="Kelola kategori event untuk portal admin Jeevatix, termasuk tambah, edit, dan hapus kategori."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-5 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A13</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Manajemen kategori event
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Kurasi kategori yang dipakai seller di seluruh platform, termasuk ikon, slug, dan jumlah
        event yang masih terhubung.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        type="button"
        onclick={() => loadCategories(true)}
        disabled={isRefreshing || isLoading}
      >
        <RefreshCw class={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
      <Button type="button" onclick={openCreateModal}>
        <Plus class="mr-2 size-4" />
        Tambah Kategori
      </Button>
    </div>
  </div>

  {#if toast}
    <Toast
      actionLabel={undefined}
      title={toast.title}
      description={toast.description}
      variant={toast.variant}
      class="border-border/60"
    />
  {/if}

  {#if pageError}
    <Toast
      title="Gagal memuat data"
      description={pageError}
      actionLabel={undefined}
      variant="warning"
    />
  {/if}

  <Card
    title="Daftar kategori"
    description="Tabel ini menampilkan slug aktif, ikon, dan total event yang masih menggunakan setiap kategori."
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
        rows={categories}
        emptyMessage="Belum ada kategori. Tambahkan kategori pertama untuk seller."
        actionHeader="Aksi"
      >
        {#snippet rowActions(row)}
          <div class="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              type="button"
              onclick={() => editCategory(row as Category)}
            >
              <Pencil class="mr-2 size-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              class="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
              onclick={() => requestDeleteCategory(row as Category)}
            >
              <Trash2 class="mr-2 size-3.5" />
              Hapus
            </Button>
          </div>
        {/snippet}
      </DataTable>
    {/if}
  </Card>

  <Modal
    open={isFormModalOpen}
    title={formMode === 'create' ? 'Tambah kategori baru' : 'Edit kategori'}
    description={formMode === 'create'
      ? 'Masukkan nama kategori dan ikon opsional. Slug akan dibuat otomatis dari nama.'
      : 'Perbarui nama atau ikon. Jika nama berubah, slug juga akan diperbarui.'}
    onClose={() => {
      isFormModalOpen = false;
      formError = '';
    }}
  >
    <form class="space-y-5" onsubmit={submitForm}>
      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="category-name">Nama</label>
        <Input id="category-name" bind:value={form.name} placeholder="Misal: Musik" required />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="category-icon">Icon</label>
        <Input id="category-icon" bind:value={form.icon} placeholder="Misal: music-2" />
      </div>

      {#if formError}
        <Toast
          title="Gagal menyimpan"
          description={formError}
          actionLabel={undefined}
          variant="warning"
        />
      {/if}

      <div class="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          onclick={() => {
            isFormModalOpen = false;
            formError = '';
          }}
        >
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {formMode === 'create' ? 'Simpan Kategori' : 'Simpan Perubahan'}
        </Button>
      </div>
    </form>
  </Modal>

  <Modal
    open={isDeleteModalOpen}
    title="Hapus kategori"
    description="Kategori yang masih dipakai event tidak bisa dihapus. Pastikan kategori ini tidak lagi terhubung ke event mana pun."
    onClose={() => {
      isDeleteModalOpen = false;
    }}
    contentClass="max-w-xl"
  >
    <div class="space-y-6">
      <div
        class="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900"
      >
        Anda akan menghapus kategori <span class="font-semibold">{selectedCategory?.name}</span>.
      </div>

      <div class="flex items-center justify-end gap-3">
        <Button variant="outline" type="button" onclick={() => (isDeleteModalOpen = false)}>
          Batal
        </Button>
        <Button
          type="button"
          class="bg-rose-600 hover:bg-rose-700"
          onclick={confirmDelete}
          disabled={isSubmitting}
        >
          Hapus Permanen
        </Button>
      </div>
    </div>
  </Modal>
</section>
