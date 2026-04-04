<script lang="ts">
  import { onMount } from 'svelte';
  import { Bell, Megaphone, RefreshCw, Send } from '@lucide/svelte';
  import { Badge, Button, Card, DataTable, Input, Modal, Toast } from '@jeevatix/ui';

  import { apiGetEnvelope, apiPost, ApiError } from '$lib/api';

  type NotificationType =
    | 'order_confirmed'
    | 'payment_reminder'
    | 'event_reminder'
    | 'new_order'
    | 'event_approved'
    | 'event_rejected'
    | 'info';

  type TargetRole = 'buyer' | 'seller' | 'admin' | 'all';

  type AdminNotificationItem = {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    isRead: boolean;
    createdAt: string;
    metadata: Record<string, unknown> | null;
    user: {
      id: string;
      fullName: string;
      email: string;
      role: 'buyer' | 'seller' | 'admin';
    };
  };

  type PaginationMeta = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  type BroadcastResult = {
    message: string;
    sent_count: number;
    target_role: 'buyer' | 'seller' | 'all';
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const columns = [
    { key: 'title', header: 'Notifikasi' },
    { key: 'recipientLabel', header: 'Penerima' },
    { key: 'typeLabel', header: 'Tipe' },
    { key: 'statusLabel', header: 'Status' },
    { key: 'createdLabel', header: 'Dikirim' },
  ];

  const typeOptions = [
    { value: 'all', label: 'Semua tipe' },
    { value: 'order_confirmed', label: 'Order Confirmed' },
    { value: 'payment_reminder', label: 'Payment Reminder' },
    { value: 'event_reminder', label: 'Event Reminder' },
    { value: 'new_order', label: 'New Order' },
    { value: 'event_approved', label: 'Event Approved' },
    { value: 'event_rejected', label: 'Event Rejected' },
    { value: 'info', label: 'Info' },
  ] as const;

  const roleOptions = [
    { value: 'all', label: 'Semua role' },
    { value: 'buyer', label: 'Buyer' },
    { value: 'seller', label: 'Seller' },
    { value: 'admin', label: 'Admin' },
  ] as const;

  const broadcastRoleOptions = [
    { value: 'all', label: 'Semua user aktif' },
    { value: 'buyer', label: 'Buyer' },
    { value: 'seller', label: 'Seller' },
  ] as const;

  let notifications = $state<AdminNotificationItem[]>([]);
  let meta = $state<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  let search = $state('');
  let searchDraft = $state('');
  let typeFilter = $state<(typeof typeOptions)[number]['value']>('all');
  let roleFilter = $state<(typeof roleOptions)[number]['value']>('all');
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let isSubmitting = $state(false);
  let pageError = $state('');
  let toast = $state<ToastState | null>(null);
  let isBroadcastOpen = $state(false);
  let broadcastForm = $state({
    title: '',
    body: '',
    targetRole: 'all' as Exclude<TargetRole, 'admin'>,
  });
  let broadcastError = $state('');

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3500);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function formatType(type: NotificationType) {
    return type
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function getQueryString(page = meta.page) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(meta.limit),
    });

    if (search) {
      params.set('search', search);
    }

    if (typeFilter !== 'all') {
      params.set('type', typeFilter);
    }

    if (roleFilter !== 'all') {
      params.set('targetRole', roleFilter);
    }

    return params.toString();
  }

  async function loadNotifications(page = meta.page, showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const result = await apiGetEnvelope<
        { notifications: AdminNotificationItem[] },
        PaginationMeta
      >(`/admin/notifications?${getQueryString(page)}`);

      notifications = result.data.notifications;
      meta = result.meta ?? meta;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Gagal memuat notifikasi.';
      pageError = message;
      setToast({ title: 'Gagal memuat notifikasi', description: message, variant: 'warning' });
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function applyFilters() {
    search = searchDraft.trim();
    void loadNotifications(1, true);
  }

  async function submitBroadcast(event: SubmitEvent) {
    event.preventDefault();
    broadcastError = '';

    if (!broadcastForm.title.trim() || !broadcastForm.body.trim()) {
      broadcastError = 'Judul dan isi broadcast wajib diisi.';
      return;
    }

    isSubmitting = true;

    try {
      const result = await apiPost<BroadcastResult>('/admin/notifications/broadcast', {
        title: broadcastForm.title.trim(),
        body: broadcastForm.body.trim(),
        target_role: broadcastForm.targetRole,
      });

      isBroadcastOpen = false;
      broadcastForm = { title: '', body: '', targetRole: 'all' };
      setToast({
        title: 'Broadcast terkirim',
        description: `${result.sent_count} notifikasi terkirim ke target ${result.target_role}.`,
        variant: 'success',
      });
      await loadNotifications(1, true);
    } catch (error) {
      broadcastError = error instanceof ApiError ? error.message : 'Broadcast gagal dikirim.';
    } finally {
      isSubmitting = false;
    }
  }

  function previousPage() {
    if (meta.page > 1) {
      void loadNotifications(meta.page - 1, true);
    }
  }

  function nextPage() {
    if (meta.totalPages > meta.page) {
      void loadNotifications(meta.page + 1, true);
    }
  }

  const tableRows = $derived(
    notifications.map((notification) => ({
      ...notification,
      recipientLabel: `${notification.user.fullName} - ${notification.user.role}`,
      typeLabel: formatType(notification.type),
      statusLabel: notification.isRead ? 'Read' : 'Unread',
      createdLabel: formatDate(notification.createdAt),
    })),
  );

  const unreadCount = $derived(notifications.filter((item) => !item.isRead).length);

  onMount(async () => {
    await loadNotifications();
  });
</script>

<svelte:head>
  <title>Notifications | Jeevatix Admin</title>
  <meta
    name="description"
    content="Pantau notifikasi platform dan kirim broadcast ke buyer atau seller dari admin portal Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-5 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A14</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Notifications
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Audit semua notifikasi platform dan kirim broadcast operasional ke buyer atau seller aktif.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        type="button"
        onclick={() => loadNotifications(meta.page, true)}
        disabled={isRefreshing || isLoading}
      >
        <RefreshCw class={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
      <Button type="button" onclick={() => (isBroadcastOpen = true)}>
        <Megaphone class="mr-2 size-4" />
        Broadcast
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
          <p class="text-sm text-slate-500">Total notifikasi</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{meta.total}</p>
        </div>
        <div class="bg-jeevatix-50 text-jeevatix-700 rounded-2xl p-3">
          <Bell class="size-6" />
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
          <p class="text-sm text-slate-500">Unread di hasil</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{unreadCount}</p>
        </div>
        <div class="bg-sea-50 text-sea-700 rounded-2xl p-3">
          <Megaphone class="size-6" />
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
          <p class="text-sm text-slate-500">Halaman aktif</p>
          <p class="mt-2 text-3xl font-semibold text-slate-950">{meta.page}</p>
        </div>
        <div class="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <RefreshCw class="size-6" />
        </div>
      </div>
    </Card>
  </div>

  <Card
    title="Filter notifikasi"
    description="Telusuri judul, isi, atau penerima notifikasi, lalu kombinasikan dengan tipe dan role target."
    class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
  >
    <form
      class="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr_auto]"
      onsubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
    >
      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="notification-search"
          >Cari notifikasi</label
        >
        <Input
          id="notification-search"
          bind:value={searchDraft}
          placeholder="Judul, isi, nama user, atau email"
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="notification-type">Tipe</label>
        <select
          id="notification-type"
          bind:value={typeFilter}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
        >
          {#each typeOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="notification-role">Role</label>
        <select
          id="notification-role"
          bind:value={roleFilter}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
        >
          {#each roleOptions as option (option.value)}
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
    title="Timeline notifikasi"
    description="Daftar notifikasi lintas platform untuk audit operasional dan komunikasi sistem."
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
        emptyMessage="Belum ada notifikasi yang cocok dengan filter saat ini."
      >
        {#snippet cell(row, column)}
          {@const notification = row as AdminNotificationItem}
          {#if column.key === 'title'}
            <div class="space-y-1">
              <p class="font-semibold text-slate-950">{notification.title}</p>
              <p class="max-w-md text-sm leading-6 text-slate-600">{notification.body}</p>
            </div>
          {:else if column.key === 'statusLabel'}
            <Badge variant={notification.isRead ? 'neutral' : 'warning'}>
              {notification.isRead ? 'Read' : 'Unread'}
            </Badge>
          {:else if column.key === 'typeLabel'}
            <Badge variant="default">{formatType(notification.type)}</Badge>
          {:else}
            {(row as Record<string, unknown>)[column.key]}
          {/if}
        {/snippet}
      </DataTable>
    {/if}

    {#snippet footer()}
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-500">
          Menampilkan <span class="font-semibold text-slate-900">{notifications.length}</span> dari {meta.total}
          notifikasi.
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
    {/snippet}
  </Card>

  <Modal
    open={isBroadcastOpen}
    title="Broadcast notifikasi"
    description="Kirim pengumuman sistem ke buyer atau seller aktif. Broadcast akan disimpan sebagai notifikasi info."
    onClose={() => {
      isBroadcastOpen = false;
      broadcastError = '';
    }}
  >
    <form class="space-y-5" onsubmit={submitBroadcast}>
      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="broadcast-title">Judul</label>
        <Input
          id="broadcast-title"
          bind:value={broadcastForm.title}
          placeholder="Pengumuman sistem"
          required
        />
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="broadcast-target-role">Target</label>
        <select
          id="broadcast-target-role"
          bind:value={broadcastForm.targetRole}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 h-11 w-full rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
        >
          {#each broadcastRoleOptions as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="broadcast-body">Isi broadcast</label>
        <textarea
          id="broadcast-body"
          bind:value={broadcastForm.body}
          class="focus:border-jeevatix-400 focus:ring-jeevatix-200 min-h-36 w-full rounded-[1.5rem] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition outline-none focus:ring-2"
          placeholder="Tuliskan pengumuman yang akan dikirim ke target terpilih"
          required
        ></textarea>
      </div>

      {#if broadcastError}
        <Toast
          title="Gagal mengirim"
          description={broadcastError}
          actionLabel={undefined}
          variant="warning"
        />
      {/if}

      <div class="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          onclick={() => {
            isBroadcastOpen = false;
            broadcastError = '';
          }}
        >
          Batal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          <Send class="mr-2 size-4" />
          Kirim broadcast
        </Button>
      </div>
    </form>
  </Modal>
</section>
