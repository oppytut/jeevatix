<script lang="ts">
  import {
    BadgeCheck,
    BellRing,
    CalendarClock,
    CheckCircle2,
    CircleAlert,
    Info,
    ShoppingCart,
    Sparkles,
  } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { Button, Card, Toast } from '@jeevatix/ui';

  import { ApiError, apiGetResponse, apiPatch } from '$lib/api';

  type PaginationMeta = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  type SellerNotification = {
    id: string;
    type:
      | 'order_confirmed'
      | 'payment_reminder'
      | 'event_reminder'
      | 'new_order'
      | 'event_approved'
      | 'event_rejected'
      | 'info';
    title: string;
    body: string;
    is_read: boolean;
    metadata: Record<string, unknown> | null;
    created_at: string;
  };

  type NotificationPayload = {
    notifications: SellerNotification[];
    unread_count: number;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  let notifications = $state<SellerNotification[]>([]);
  let meta = $state<PaginationMeta>({ total: 0, page: 1, limit: 20, totalPages: 0 });
  let unreadCount = $state(0);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let markingId = $state<string | null>(null);
  let isMarkingAll = $state(false);
  let pageError = $state('');
  let toast = $state<ToastState | null>(null);

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3600);
  }

  function broadcastUnreadCount() {
    window.dispatchEvent(new CustomEvent('seller-notifications-updated'));
  }

  function formatLongDateTime(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function formatRelativeTime(value: string) {
    const now = Date.now();
    const target = new Date(value).getTime();
    const diffMinutes = Math.round((target - now) / 60_000);
    const formatter = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });

    if (Math.abs(diffMinutes) < 60) {
      return formatter.format(diffMinutes, 'minute');
    }

    const diffHours = Math.round(diffMinutes / 60);

    if (Math.abs(diffHours) < 24) {
      return formatter.format(diffHours, 'hour');
    }

    const diffDays = Math.round(diffHours / 24);
    return formatter.format(diffDays, 'day');
  }

  function getNotificationIcon(type: SellerNotification['type']) {
    switch (type) {
      case 'new_order':
        return ShoppingCart;
      case 'event_approved':
        return CheckCircle2;
      case 'event_rejected':
        return CircleAlert;
      case 'event_reminder':
        return CalendarClock;
      case 'payment_reminder':
        return Sparkles;
      case 'order_confirmed':
        return BadgeCheck;
      default:
        return Info;
    }
  }

  function getNotificationIconClass(type: SellerNotification['type']) {
    switch (type) {
      case 'new_order':
        return 'bg-sky-100 text-sky-700';
      case 'event_approved':
      case 'order_confirmed':
        return 'bg-emerald-100 text-emerald-700';
      case 'event_rejected':
        return 'bg-rose-100 text-rose-700';
      case 'event_reminder':
        return 'bg-violet-100 text-violet-700';
      case 'payment_reminder':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-slate-200 text-slate-700';
    }
  }

  async function loadNotifications(page = 1, refresh = false) {
    pageError = '';

    if (refresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      const response = await apiGetResponse<NotificationPayload, PaginationMeta>(
        `/notifications?page=${page}&limit=${meta.limit}`,
      );
      notifications = response.data.notifications;
      unreadCount = response.data.unread_count;
      meta = response.meta ?? { total: notifications.length, page, limit: meta.limit, totalPages: 1 };
      broadcastUnreadCount();
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat notifikasi seller.';
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  async function markRead(notification: SellerNotification) {
    if (notification.is_read || markingId) {
      return;
    }

    markingId = notification.id;

    try {
      const updated = await apiPatch<SellerNotification>(`/notifications/${notification.id}/read`, {});
      notifications = notifications.map((entry) => (entry.id === updated.id ? updated : entry));
      unreadCount = Math.max(0, unreadCount - 1);
      broadcastUnreadCount();
    } catch (error) {
      setToast({
        title: 'Gagal menandai notifikasi',
        description: error instanceof ApiError ? error.message : 'Status notifikasi belum berubah.',
        variant: 'warning',
      });
    } finally {
      markingId = null;
    }
  }

  async function markAllRead() {
    if (isMarkingAll || unreadCount === 0) {
      return;
    }

    isMarkingAll = true;

    try {
      await apiPatch<{ message: string; unread_count: number }>('/notifications/read-all', {});
      notifications = notifications.map((entry) => ({ ...entry, is_read: true }));
      unreadCount = 0;
      broadcastUnreadCount();
      setToast({
        title: 'Semua notifikasi dibaca',
        description: 'Inbox seller sudah dibersihkan dari notifikasi unread.',
        variant: 'success',
      });
    } catch (error) {
      setToast({
        title: 'Gagal menandai semua notifikasi',
        description: error instanceof ApiError ? error.message : 'Coba lagi dalam beberapa saat.',
        variant: 'warning',
      });
    } finally {
      isMarkingAll = false;
    }
  }

  async function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > Math.max(meta.totalPages, 1) || nextPage === meta.page) {
      return;
    }

    await loadNotifications(nextPage, true);
  }

  onMount(() => {
    void loadNotifications();
  });
</script>

<svelte:head>
  <title>Seller Notifications | Jeevatix</title>
  <meta
    name="description"
    content="Pantau pesanan baru, approval event, dan update operasional seller dari inbox notifikasi Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div class="rounded-[2.5rem] border border-white/80 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_34%,#ecfeff_100%)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">S16</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Semua update seller terkumpul di satu inbox.
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Cek pesanan baru, persetujuan event, reminder penting, dan tindak lanjut operasional tanpa keluar dari workspace seller.
        </p>
      </div>

      <div class="rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-4 backdrop-blur">
        <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Unread</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">{unreadCount}</p>
      </div>
    </div>
  </div>

  {#if toast}
    <Toast title={toast.title} description={toast.description} variant={toast.variant} actionLabel={undefined} />
  {/if}

  {#if pageError}
    <Toast title="Gagal memuat notifikasi" description={pageError} variant="warning" actionLabel={undefined} />
  {/if}

  <Card class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Inbox</p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Pusat notifikasi seller</h2>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button variant="outline" type="button" class="rounded-full px-5" onclick={() => loadNotifications(meta.page, true)} disabled={isLoading || isRefreshing}>
          Refresh
        </Button>
        <Button type="button" class="rounded-full px-5" onclick={markAllRead} disabled={unreadCount === 0 || isMarkingAll}>
          Mark All as Read
        </Button>
      </div>
    </div>

    <div class="mt-8 space-y-4">
      {#if isLoading}
        <div class="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
          Memuat notifikasi seller...
        </div>
      {:else if notifications.length === 0}
        <div class="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <div class="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <BellRing class="size-7" />
          </div>
          <h3 class="mt-5 text-2xl font-semibold tracking-tight text-slate-950">Belum ada notifikasi</h3>
          <p class="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
            Saat ada pesanan baru atau perubahan status event, notifikasinya akan muncul di halaman ini.
          </p>
        </div>
      {:else}
        {#each notifications as notification (notification.id)}
          {@const NotificationIcon = getNotificationIcon(notification.type)}

          <button
            type="button"
            class={`w-full rounded-[1.75rem] border p-5 text-left transition ${notification.is_read ? 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-50' : 'border-sky-200 bg-sky-50/80 hover:border-sky-300 hover:bg-sky-50'}`}
            onclick={() => markRead(notification)}
            disabled={markingId === notification.id}
          >
            <div class="flex items-start gap-4">
              <div class={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${getNotificationIconClass(notification.type)}`}>
                <NotificationIcon class="size-6" />
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="text-lg font-semibold text-slate-950">{notification.title}</h3>
                      {#if !notification.is_read}
                        <span class="rounded-full bg-sky-600 px-2.5 py-1 text-[0.7rem] font-semibold tracking-[0.2em] text-white uppercase">
                          Unread
                        </span>
                      {/if}
                    </div>
                    <p class="mt-2 text-sm leading-7 text-slate-600">{notification.body}</p>
                  </div>

                  <div class="shrink-0 text-left sm:text-right">
                    <p class="text-sm font-medium text-slate-900">{formatRelativeTime(notification.created_at)}</p>
                    <p class="mt-1 text-xs text-slate-500">{formatLongDateTime(notification.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </button>
        {/each}
      {/if}
    </div>

    <div class="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <p class="text-sm text-slate-500">
        Page {meta.page} dari {Math.max(meta.totalPages, 1)} • Total {meta.total} notifikasi
      </p>

      <div class="flex items-center gap-3">
        <Button variant="outline" type="button" onclick={() => changePage(meta.page - 1)} disabled={meta.page <= 1 || isRefreshing}>
          Sebelumnya
        </Button>
        <Button variant="outline" type="button" onclick={() => changePage(meta.page + 1)} disabled={meta.page >= meta.totalPages || meta.totalPages === 0 || isRefreshing}>
          Berikutnya
        </Button>
      </div>
    </div>
  </Card>
</section>