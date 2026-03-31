<script lang="ts">
  import {
    BadgeCheck,
    BellRing,
    CalendarClock,
    CircleAlert,
    Info,
    ShoppingCart,
  } from '@lucide/svelte';

  import { Button, Card } from '@jeevatix/ui';

  import { formatLongDateTime, formatRelativeTime } from '$lib/utils';

  let { data, form }: import('./$types').PageProps = $props();

  function getNotifications() {
    return form?.notifications ?? data.notifications;
  }

  function getUnreadCount() {
    return form?.unread_count ?? data.unread_count;
  }
</script>

<svelte:head>
  <title>Notifikasi Buyer | Jeevatix</title>
  <meta
    name="description"
    content="Pantau update transaksi, reminder event, dan informasi penting akun buyer Jeevatix dari satu halaman notifikasi."
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div class="rounded-[2.5rem] border border-white/80 bg-[linear-gradient(135deg,#eef9ff_0%,#ffffff_34%,#fff4e5_100%)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">Notifications</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Semua update penting buyer terkumpul di sini.
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Lihat konfirmasi transaksi, pengingat event, dan informasi akun tanpa perlu menelusuri email satu per satu.
        </p>
      </div>

      <div class="rounded-[1.5rem] border border-white/70 bg-white/80 px-5 py-4 backdrop-blur">
        <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Unread</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">{getUnreadCount()}</p>
      </div>
    </div>
  </div>

  <Card class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Inbox</p>
        <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Pusat notifikasi buyer</h2>
      </div>

      <form method="POST" action="?/markAllRead">
        <Button type="submit" class="rounded-full px-5" disabled={getUnreadCount() === 0}>
          Mark All as Read
        </Button>
      </form>
    </div>

    {#if form?.notificationsError}
      <div class="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {form.notificationsError}
      </div>
    {/if}

    {#if form?.notificationsSuccess}
      <div class="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        {form.notificationsSuccess}
      </div>
    {/if}

    <div class="mt-8 space-y-4">
      {#if getNotifications().length === 0}
        <div class="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
          <div class="mx-auto flex size-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <BellRing class="size-7" />
          </div>
          <h3 class="mt-5 text-2xl font-semibold tracking-tight text-slate-950">Belum ada notifikasi</h3>
          <p class="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
            Saat order terkonfirmasi atau ada update event penting, notifikasinya akan muncul di halaman ini.
          </p>
        </div>
      {:else}
        {#each getNotifications() as notification}
          <form method="POST" action="?/markRead">
            <input type="hidden" name="notification_id" value={notification.id} />

            <button
              type="submit"
              class={`w-full rounded-[1.75rem] border p-5 text-left transition ${notification.is_read ? 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-slate-50' : 'border-sky-200 bg-sky-50/80 hover:border-sky-300 hover:bg-sky-50'}`}
            >
              <div class="flex items-start gap-4">
                <div class={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${notification.type === 'order_confirmed' ? 'bg-emerald-100 text-emerald-700' : notification.type === 'payment_reminder' ? 'bg-amber-100 text-amber-700' : notification.type === 'event_reminder' ? 'bg-violet-100 text-violet-700' : notification.type === 'new_order' ? 'bg-sky-100 text-sky-700' : notification.type === 'event_approved' ? 'bg-emerald-100 text-emerald-700' : notification.type === 'event_rejected' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}`}>
                  {#if notification.type === 'order_confirmed' || notification.type === 'event_approved'}
                    <BadgeCheck class="size-6" />
                  {:else if notification.type === 'payment_reminder'}
                    <CircleAlert class="size-6" />
                  {:else if notification.type === 'event_reminder'}
                    <CalendarClock class="size-6" />
                  {:else if notification.type === 'new_order'}
                    <ShoppingCart class="size-6" />
                  {:else if notification.type === 'event_rejected'}
                    <CircleAlert class="size-6" />
                  {:else}
                    <Info class="size-6" />
                  {/if}
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
          </form>
        {/each}
      {/if}
    </div>
  </Card>
</section>