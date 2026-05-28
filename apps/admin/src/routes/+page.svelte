<script lang="ts">
  import { AreaChart, ReceiptText, Ticket, UserRound, Users, Wallet } from '@lucide/svelte';
  import { Badge, Card, Toast } from '@jeevatix/ui';

  type AdminDashboardPageData = {
    dashboard: {
      total_users: number;
      total_sellers: number;
      total_buyers: number;
      total_events: number;
      total_events_published: number;
      total_revenue: number;
      total_tickets_sold: number;
      daily_transactions: Array<{
        date: string;
        transaction_count: number;
      }>;
      recent_events: Array<{
        id: string;
        name: string;
        seller: string;
        status:
          | 'draft'
          | 'pending_review'
          | 'published'
          | 'rejected'
          | 'ongoing'
          | 'completed'
          | 'cancelled';
        created_at: string;
      }>;
      recent_orders: Array<{
        id: string;
        order_number: string;
        buyer: string;
        total_amount: number;
        status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
        created_at: string;
      }>;
    } | null;
    loadError: string | null;
  };

  type DailyTransactionPoint = NonNullable<
    AdminDashboardPageData['dashboard']
  >['daily_transactions'][number];

  let { data }: { data: AdminDashboardPageData } = $props();

  const chartWidth = 760;
  const chartHeight = 280;
  const paddingLeft = 24;
  const paddingRight = 20;
  const paddingTop = 18;
  const paddingBottom = 34;

  const dashboard = $derived(data.dashboard);
  const transactions = $derived(dashboard?.daily_transactions ?? []);
  const maxTransactions = $derived(
    Math.max(1, ...transactions.map((point: DailyTransactionPoint) => point.transaction_count)),
  );
  const totalTransactions = $derived(
    transactions.reduce(
      (total: number, point: DailyTransactionPoint) => total + point.transaction_count,
      0,
    ),
  );
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const barWidth = $derived(
    transactions.length === 0 ? 0 : Math.max(8, plotWidth / Math.max(transactions.length, 1) - 6),
  );
  const chartLabels = $derived(
    transactions.length > 0
      ? [
          transactions[0],
          transactions[Math.floor((transactions.length - 1) / 2)],
          transactions[transactions.length - 1],
        ].filter(
          (value, index, allValues) =>
            allValues.findIndex((item) => item.date === value.date) === index,
        )
      : [],
  );

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function formatDayLabel(value: string) {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
    }).format(new Date(value));
  }

  function getEventStatusVariant(
    status: NonNullable<AdminDashboardPageData['dashboard']>['recent_events'][number]['status'],
  ) {
    switch (status) {
      case 'published':
      case 'ongoing':
        return 'success';
      case 'rejected':
      case 'cancelled':
        return 'warning';
      case 'completed':
        return 'neutral';
      default:
        return 'default';
    }
  }

  function getOrderStatusVariant(
    status: NonNullable<AdminDashboardPageData['dashboard']>['recent_orders'][number]['status'],
  ) {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'expired':
      case 'cancelled':
        return 'warning';
      case 'refunded':
        return 'neutral';
      default:
        return 'default';
    }
  }
</script>

<svelte:head>
  <title>Admin Dashboard | Jeevatix</title>
  <meta
    name="description"
    content="Pantau performa platform Jeevatix: user, seller, event, revenue, tiket terjual, transaksi harian, event terbaru, dan order terbaru."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
  >
    <div
      class="grid gap-8 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.96)_45%,rgba(251,191,36,0.10)_100%)] p-8 sm:p-10 xl:grid-cols-[1.15fr_0.85fr]"
    >
      <div class="space-y-4">
        <p class="text-sm font-semibold tracking-[0.35em] text-muted-foreground uppercase">A2</p>
        <h1 class="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Admin Dashboard
        </h1>
        <p class="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
          Ringkasan operasional platform untuk membaca pertumbuhan pengguna, performa event, dan
          ritme transaksi harian dari satu layar.
        </p>
      </div>

      <div
        class="rounded-[1.75rem] border border-slate-900/10 bg-foreground p-6 text-background shadow-[0_20px_50px_rgba(15,23,42,0.24)]"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-muted-foreground">30-Day Transactions</p>
            <p class="mt-3 text-4xl font-semibold">{totalTransactions}</p>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">
              transaksi sukses dalam 30 hari terakhir untuk membaca pace aktivitas platform.
            </p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-card/8 p-3">
            <AreaChart class="size-5 text-sky-300" />
          </div>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl border border-white/10 bg-card/6 p-4">
            <p class="text-xs font-medium tracking-[0.25em] text-muted-foreground/70 uppercase">Buyers</p>
            <p class="mt-2 text-lg font-semibold">{dashboard?.total_buyers ?? 0}</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-card/6 p-4">
            <p class="text-xs font-medium tracking-[0.25em] text-muted-foreground/70 uppercase">Revenue</p>
            <p class="mt-2 text-lg font-semibold">
              {formatCurrency(dashboard?.total_revenue ?? 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if data.loadError}
    <Toast
      title="Gagal memuat dashboard"
      description={data.loadError}
      variant="warning"
      actionLabel={undefined}
    />
  {/if}

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <div class="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-muted-foreground">Total User</p>
          <p class="mt-3 text-3xl font-semibold text-foreground">{dashboard?.total_users ?? 0}</p>
        </div>
        <div class="rounded-2xl bg-muted p-3 text-muted-foreground">
          <Users class="size-5" />
        </div>
      </div>
    </div>

    <div class="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-muted-foreground">Total Seller</p>
          <p class="mt-3 text-3xl font-semibold text-foreground">{dashboard?.total_sellers ?? 0}</p>
        </div>
        <div class="rounded-2xl bg-sky-50 p-3 text-sky-700">
          <UserRound class="size-5" />
        </div>
      </div>
    </div>

    <div class="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-muted-foreground">Total Event</p>
          <p class="mt-3 text-3xl font-semibold text-foreground">{dashboard?.total_events ?? 0}</p>
        </div>
        <div class="rounded-2xl bg-indigo-50 p-3 text-indigo-700">
          <AreaChart class="size-5" />
        </div>
      </div>
    </div>

    <div class="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-muted-foreground">Total Revenue</p>
          <p class="mt-3 text-3xl font-semibold text-foreground">
            {formatCurrency(dashboard?.total_revenue ?? 0)}
          </p>
        </div>
        <div class="rounded-2xl bg-amber-50 p-3 text-amber-700">
          <Wallet class="size-5" />
        </div>
      </div>
    </div>

    <div class="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-muted-foreground">Tiket Terjual</p>
          <p class="mt-3 text-3xl font-semibold text-foreground">
            {dashboard?.total_tickets_sold ?? 0}
          </p>
        </div>
        <div class="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          <Ticket class="size-5" />
        </div>
      </div>
    </div>

    <div class="rounded-[1.75rem] border border-border bg-card p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm text-muted-foreground">Event Published</p>
          <p class="mt-3 text-3xl font-semibold text-foreground">
            {dashboard?.total_events_published ?? 0}
          </p>
        </div>
        <div class="rounded-2xl bg-rose-50 p-3 text-rose-700">
          <ReceiptText class="size-5" />
        </div>
      </div>
    </div>
  </div>

  <Card
    title="Transaksi harian"
    description="Bar chart jumlah transaksi sukses dalam 30 hari terakhir."
    class="rounded-[2rem] border border-border bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
  >
    <div
      class="rounded-[1.6rem] border border-border bg-[linear-gradient(180deg,rgba(239,246,255,0.85),rgba(255,255,255,1))] p-4 sm:p-5"
    >
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        class="h-auto w-full overflow-visible"
        role="img"
        aria-label="Grafik transaksi harian 30 hari terakhir"
      >
        {#each [0, Math.round(maxTransactions / 2), maxTransactions] as tick (tick)}
          {@const y = paddingTop + plotHeight - (tick / maxTransactions) * plotHeight}
          <line
            x1={paddingLeft}
            y1={y}
            x2={chartWidth - paddingRight}
            y2={y}
            stroke="rgba(148,163,184,0.22)"
            stroke-dasharray="4 8"
          ></line>
          <text x="0" y={y + 4} fill="rgba(100,116,139,0.88)" font-size="12">{tick}</text>
        {/each}

        {#each transactions as point, index (point.date)}
          {@const x =
            transactions.length === 0
              ? paddingLeft
              : paddingLeft + index * (plotWidth / Math.max(transactions.length, 1))}
          {@const height = (point.transaction_count / maxTransactions) * plotHeight}
          <rect
            {x}
            y={paddingTop + plotHeight - height}
            width={barWidth}
            {height}
            rx="8"
            fill="rgb(37,99,235)"
            opacity="0.92"
          ></rect>
        {/each}
      </svg>

      <div
        class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-medium tracking-[0.22em] text-muted-foreground uppercase"
      >
        {#each chartLabels as label (label.date)}
          <span>{formatDayLabel(label.date)}</span>
        {/each}
      </div>
    </div>
  </Card>

  <div class="grid gap-6 xl:grid-cols-2">
    <Card
      title="Event terbaru"
      description="Lima event terbaru yang masuk ke platform."
      class="rounded-[2rem] border border-border bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
    >
      {#if !dashboard || dashboard.recent_events.length === 0}
        <div
          class="flex min-h-64 items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-muted text-sm text-muted-foreground"
        >
          Belum ada event terbaru yang bisa ditampilkan.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-border text-left text-sm">
            <thead>
              <tr class="text-muted-foreground">
                <th class="px-4 py-3 font-semibold">Name</th>
                <th class="px-4 py-3 font-semibold">Seller</th>
                <th class="px-4 py-3 font-semibold">Status</th>
                <th class="px-4 py-3 font-semibold">Tanggal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              {#each dashboard.recent_events as event (event.id)}
                <tr class="hover:bg-muted">
                  <td class="px-4 py-4 font-medium text-foreground">{event.name}</td>
                  <td class="px-4 py-4 text-foreground">{event.seller}</td>
                  <td class="px-4 py-4">
                    <Badge variant={getEventStatusVariant(event.status)}>{event.status}</Badge>
                  </td>
                  <td class="px-4 py-4 text-foreground">{formatDate(event.created_at)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>

    <Card
      title="Pesanan terbaru"
      description="Lima order terbaru lintas buyer dan event di seluruh platform."
      class="rounded-[2rem] border border-border bg-card/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
    >
      {#if !dashboard || dashboard.recent_orders.length === 0}
        <div
          class="flex min-h-64 items-center justify-center rounded-[1.5rem] border border-dashed border-border bg-muted text-sm text-muted-foreground"
        >
          Belum ada pesanan terbaru yang bisa ditampilkan.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-border text-left text-sm">
            <thead>
              <tr class="text-muted-foreground">
                <th class="px-4 py-3 font-semibold">Order Number</th>
                <th class="px-4 py-3 font-semibold">Buyer</th>
                <th class="px-4 py-3 font-semibold">Total</th>
                <th class="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border">
              {#each dashboard.recent_orders as order (order.id)}
                <tr class="hover:bg-muted">
                  <td class="px-4 py-4 font-medium text-foreground">{order.order_number}</td>
                  <td class="px-4 py-4 text-foreground">{order.buyer}</td>
                  <td class="px-4 py-4 font-medium text-foreground"
                    >{formatCurrency(order.total_amount)}</td
                  >
                  <td class="px-4 py-4">
                    <Badge variant={getOrderStatusVariant(order.status)}>{order.status}</Badge>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>
  </div>
</section>
