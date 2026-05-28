<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import {
    ArrowLeft,
    CheckCircle2,
    CircleAlert,
    CircleX,
    LoaderCircle,
    QrCode,
    RefreshCw,
    TicketCheck,
    UserRound,
  } from '@lucide/svelte';
  import { Button, Card, EmptyState, Input, Toast } from '@jeevatix/ui';

  import { ApiError, apiGet, apiPost } from '$lib/api';

  type CheckinStatus = 'SUCCESS' | 'ALREADY_USED' | 'INVALID';

  type CheckinResult = {
    status: CheckinStatus;
    ticket_id: string | null;
    ticket_code: string | null;
    buyer_name: string | null;
    buyer_email: string | null;
    tier_name: string | null;
    checked_in_at: string | null;
    message: string;
  };

  type RecentCheckinItem = {
    id: string;
    ticket_id: string;
    ticket_code: string;
    buyer_name: string | null;
    buyer_email: string | null;
    tier_name: string;
    checked_in_at: string;
  };

  type CheckinStats = {
    event_id: string;
    event_title: string;
    total_tickets: number;
    checked_in: number;
    remaining: number;
    percentage: number;
    recent_checkins: RecentCheckinItem[];
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const eventId = $derived(page.params.id);

  let ticketCode = $state('');
  let stats = $state<CheckinStats | null>(null);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let isSubmitting = $state(false);
  let pageError = $state('');
  let result = $state<CheckinResult | null>(null);
  let toast = $state<ToastState | null>(null);

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3600);
  }

  function formatDateTime(value: string | null) {
    if (!value) {
      return '—';
    }

    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatRelativeTime(value: string) {
    const formatter = new Intl.RelativeTimeFormat('id-ID', { numeric: 'auto' });
    const diffMs = new Date(value).getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / (1000 * 60));

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

  function getResultTone(status: CheckinStatus) {
    switch (status) {
      case 'SUCCESS':
        return {
          card: 'border-emerald-200 bg-emerald-50 text-emerald-950',
          badge: 'bg-emerald-600 text-white',
          icon: CheckCircle2,
          label: 'Valid',
        };
      case 'ALREADY_USED':
        return {
          card: 'border-amber-200 bg-amber-50 text-amber-950',
          badge: 'bg-amber-500 text-white',
          icon: CircleAlert,
          label: 'Already Used',
        };
      default:
        return {
          card: 'border-rose-200 bg-rose-50 text-rose-950',
          badge: 'bg-rose-600 text-white',
          icon: CircleX,
          label: 'Invalid',
        };
    }
  }

  async function loadStats(showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      stats = await apiGet<CheckinStats>(`/seller/events/${eventId}/checkin/stats`);
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat statistik check-in.';
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  async function submitCheckin() {
    if (!ticketCode.trim() || isSubmitting) {
      return;
    }

    isSubmitting = true;
    result = null;

    try {
      result = await apiPost<CheckinResult>(`/seller/events/${eventId}/checkin`, {
        ticket_code: ticketCode.trim().toUpperCase(),
      });

      if (result.status === 'SUCCESS') {
        ticketCode = '';
      }

      await loadStats(true);
    } catch (error) {
      setToast({
        title: 'Gagal memproses check-in',
        description:
          error instanceof ApiError ? error.message : 'Terjadi masalah saat memvalidasi tiket.',
        variant: 'warning',
      });
    } finally {
      isSubmitting = false;
    }
  }

  const progress = $derived(stats ? Math.max(0, Math.min(100, stats.percentage)) : 0);

  onMount(() => {
    let intervalId: number | undefined;

    void loadStats().then(() => {
      intervalId = window.setInterval(() => {
        void loadStats(true);
      }, 15000);
    });

    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  });
</script>

<svelte:head>
  <title>Seller Check-in | Jeevatix</title>
  <meta
    name="description"
    content="Halaman scanner check-in seller untuk memvalidasi tiket event, memantau statistik kehadiran, dan melihat riwayat check-in terbaru."
  />
</svelte:head>

<section class="space-y-8">
  <nav aria-label="Breadcrumb" class="text-muted-foreground mb-6 flex items-center gap-2 text-sm">
    <a href={resolve('/events')} class="hover:text-foreground transition">Events</a>
    <span>/</span>
    <a href={resolve(`/events/${eventId}`)} class="hover:text-foreground transition"
      >{stats?.event_title ?? 'Detail'}</a
    >
    <span>/</span>
    <span class="text-foreground font-medium">Check-in</span>
  </nav>

  {#if toast}
    <Toast
      title={toast.title}
      description={toast.description}
      variant={toast.variant}
      actionLabel={undefined}
    />
  {/if}

  {#if pageError}
    <Toast
      title="Gagal memuat halaman check-in"
      description={pageError}
      variant="warning"
      actionLabel={undefined}
    />
  {/if}

  <div
    class="border-border bg-card/90 rounded-[2rem] border p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.32em] uppercase">S13</p>
        <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Check-in scanner untuk {stats?.event_title ?? 'event ini'}
        </h1>
        <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
          Scan atau ketik kode tiket, lihat status validasi secara instan, dan pantau progres
          kehadiran event tanpa pindah halaman.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <Button variant="outline" type="button" onclick={() => goto(resolve(`/events/${eventId}`))}>
          <ArrowLeft class="mr-2 size-4" />
          Detail Event
        </Button>
        <Button
          variant="outline"
          type="button"
          onclick={() => loadStats(true)}
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw class={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh Stats
        </Button>
      </div>
    </div>
  </div>

  <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
    <div class="space-y-6">
      <Card class="border-border bg-card/95 rounded-[2rem] border p-8 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
              Scanner
            </p>
            <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
              Masukkan kode tiket
            </h2>
          </div>
          <div
            class="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"
          >
            <QrCode class="size-7" />
          </div>
        </div>

        <form
          class="mt-8 space-y-4"
          onsubmit={(event) => {
            event.preventDefault();
            void submitCheckin();
          }}
        >
          <div class="space-y-2">
            <label class="text-foreground text-sm font-medium" for="ticket-code">Ticket Code</label>
            <Input
              id="ticket-code"
              bind:value={ticketCode}
              placeholder="Contoh: JVX-AB12CD34EF56"
              autocomplete="off"
              class="border-border h-16 rounded-[1.4rem] px-5 font-mono text-lg tracking-[0.12em] uppercase"
            />
          </div>

          <Button
            class="h-14 w-full rounded-[1.4rem] text-base"
            type="submit"
            disabled={isSubmitting || !ticketCode.trim()}
          >
            {#if isSubmitting}
              <LoaderCircle class="mr-2 size-4 animate-spin" />
            {:else}
              <TicketCheck class="mr-2 size-4" />
            {/if}
            Check-in
          </Button>
        </form>
      </Card>

      {#if result}
        {@const tone = getResultTone(result.status)}
        {@const ResultIcon = tone.icon}
        <Card class={`rounded-[2rem] border p-8 shadow-sm ${tone.card}`}>
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-start gap-4">
              <div class="bg-card/70 mt-1 flex size-12 items-center justify-center rounded-2xl">
                <ResultIcon class="size-7" />
              </div>
              <div>
                <div
                  class={`inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-[0.24em] uppercase ${tone.badge}`}
                >
                  {tone.label}
                </div>
                <h3 class="mt-3 text-2xl font-semibold tracking-tight">{result.message}</h3>
                <p class="mt-2 font-mono text-sm tracking-[0.18em]">
                  {result.ticket_code ?? 'Kode tidak ditemukan'}
                </p>
              </div>
            </div>
          </div>

          {#if result.buyer_name || result.tier_name || result.checked_in_at}
            <div class="mt-6 grid gap-4 md:grid-cols-3">
              <div class="bg-card/70 rounded-[1.4rem] p-4">
                <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
                  Buyer
                </p>
                <p class="text-foreground mt-2 font-semibold">{result.buyer_name ?? '—'}</p>
                <p class="text-muted-foreground mt-1 text-sm">
                  {result.buyer_email ?? 'Email tidak tersedia'}
                </p>
              </div>
              <div class="bg-card/70 rounded-[1.4rem] p-4">
                <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
                  Tier
                </p>
                <p class="text-foreground mt-2 font-semibold">{result.tier_name ?? '—'}</p>
              </div>
              <div class="bg-card/70 rounded-[1.4rem] p-4">
                <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
                  Waktu Check-in
                </p>
                <p class="text-foreground mt-2 font-semibold">
                  {formatDateTime(result.checked_in_at)}
                </p>
              </div>
            </div>
          {/if}
        </Card>
      {/if}

      <Card class="border-border bg-card/95 rounded-[2rem] border p-8 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
              History
            </p>
            <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
              10 check-in terakhir
            </h2>
          </div>
          <div class="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
            <UserRound class="size-7" />
          </div>
        </div>

        {#if isLoading && !stats}
          <div class="bg-muted text-muted-foreground mt-8 rounded-[1.6rem] p-8 text-sm">
            Memuat riwayat check-in...
          </div>
        {:else if !stats || stats.recent_checkins.length === 0}
          <div class="mt-8">
            <EmptyState title="Belum ada tiket yang berhasil di-check-in untuk event ini" />
          </div>
        {:else}
          <div class="mt-8 space-y-3">
            {#each stats.recent_checkins as item (item.id)}
              <div class="border-border bg-muted rounded-[1.4rem] border p-4">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p class="text-foreground font-semibold">
                      {item.buyer_name ?? 'Buyer tidak diketahui'}
                    </p>
                    <p class="text-muted-foreground mt-1 text-sm">
                      {item.tier_name} • {item.buyer_email ?? 'Email tidak tersedia'}
                    </p>
                    <p class="text-muted-foreground mt-2 font-mono text-xs tracking-[0.18em]">
                      {item.ticket_code}
                    </p>
                  </div>
                  <div class="text-muted-foreground text-sm lg:text-right">
                    <p class="text-foreground font-medium">{formatDateTime(item.checked_in_at)}</p>
                    <p class="mt-1">{formatRelativeTime(item.checked_in_at)}</p>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>

    <div class="space-y-6">
      <Card class="border-border bg-card/95 rounded-[2rem] border p-8 shadow-sm">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
              Live Stats
            </p>
            <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
              Statistik check-in
            </h2>
          </div>
          <div class="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-700">
            Auto-refresh 15s
          </div>
        </div>

        {#if isLoading && !stats}
          <div class="bg-muted text-muted-foreground mt-8 rounded-[1.6rem] p-8 text-sm">
            Menyiapkan statistik event...
          </div>
        {:else if stats}
          <div class="mt-8 space-y-5">
            <div class="grid gap-4 sm:grid-cols-3">
              <div class="bg-muted rounded-[1.4rem] p-4">
                <p class="text-muted-foreground text-xs font-semibold tracking-[0.22em] uppercase">
                  Total Tickets
                </p>
                <p class="text-foreground mt-2 text-3xl font-semibold">{stats.total_tickets}</p>
              </div>
              <div class="rounded-[1.4rem] bg-emerald-50 p-4">
                <p class="text-xs font-semibold tracking-[0.22em] text-emerald-700 uppercase">
                  Checked-in
                </p>
                <p class="mt-2 text-3xl font-semibold text-emerald-900">{stats.checked_in}</p>
              </div>
              <div class="rounded-[1.4rem] bg-amber-50 p-4">
                <p class="text-xs font-semibold tracking-[0.22em] text-amber-700 uppercase">
                  Remaining
                </p>
                <p class="mt-2 text-3xl font-semibold text-amber-900">{stats.remaining}</p>
              </div>
            </div>

            <div class="border-border bg-muted rounded-[1.6rem] border p-5">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-foreground text-sm font-semibold">Progress kehadiran</p>
                  <p class="text-muted-foreground mt-1 text-sm">
                    {stats.checked_in} dari {stats.total_tickets} tiket sudah masuk venue.
                  </p>
                </div>
                <p class="text-foreground text-2xl font-semibold">{progress.toFixed(1)}%</p>
              </div>
              <div class="bg-muted mt-4 h-3 overflow-hidden rounded-full">
                <div
                  class="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                  style={`width: ${progress}%`}
                ></div>
              </div>
            </div>
          </div>
        {/if}
      </Card>
    </div>
  </div>
</section>
