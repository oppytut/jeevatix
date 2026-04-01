<script lang="ts">
  import { resolve } from '$app/paths';
  import {
    CalendarRange,
    ChartSpline,
    ReceiptText,
    Ticket,
    Wallet,
  } from '@lucide/svelte';
  import { Badge, Card, Toast } from '@jeevatix/ui';

  type SellerDashboardPageData = {
    dashboard: {
      total_events: number;
      total_revenue: number;
      total_tickets_sold: number;
      upcoming_events: number;
      recent_orders: Array<{
        id: string;
        order_number: string;
        event_title: string;
        buyer_name: string;
        total_amount: number;
        status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
        created_at: string;
      }>;
      daily_sales: Array<{
        date: string;
        tickets_sold: number;
      }>;
    } | null;
    loadError: string | null;
  };

  type DailySalesPoint = NonNullable<SellerDashboardPageData['dashboard']>['daily_sales'][number];
  type RecentOrderStatus = NonNullable<SellerDashboardPageData['dashboard']>['recent_orders'][number]['status'];

  let { data }: { data: SellerDashboardPageData } = $props();

  const chartWidth = 760;
  const chartHeight = 260;
  const paddingLeft = 26;
  const paddingRight = 18;
  const paddingTop = 18;
  const paddingBottom = 34;

  const dashboard = $derived(data.dashboard);
  const sales = $derived(dashboard?.daily_sales ?? []);
  const maxTicketsSold = $derived(Math.max(1, ...sales.map((point: DailySalesPoint) => point.tickets_sold)));
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const chartPoints = $derived(
    sales
      .map((point: DailySalesPoint, index: number) => {
        const x =
          sales.length <= 1
            ? paddingLeft + plotWidth / 2
            : paddingLeft + (index * plotWidth) / (sales.length - 1);
        const y = paddingTop + plotHeight - (point.tickets_sold / maxTicketsSold) * plotHeight;

        return `${x},${y}`;
      })
      .join(' '),
  );

  const areaPoints = $derived(
    chartPoints
      ? `${paddingLeft},${chartHeight - paddingBottom} ${chartPoints} ${chartWidth - paddingRight},${chartHeight - paddingBottom}`
      : '',
  );

  const yTicks = $derived(
    Array.from(new Set([0, Math.round(maxTicketsSold / 2), maxTicketsSold])).sort((left, right) =>
      left - right,
    ),
  );

  const chartLabels = $derived(
    sales.length > 0
      ? [sales[0], sales[Math.floor((sales.length - 1) / 2)], sales[sales.length - 1]].filter(
          (value, index, allValues) => allValues.findIndex((item) => item.date === value.date) === index,
        )
      : [],
  );

  const totalSalesInWindow = $derived(
    sales.reduce(
      (total: number, point: DailySalesPoint) => total + point.tickets_sold,
      0,
    ),
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

  function getOrderStatusVariant(status: RecentOrderStatus) {
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

  function getOrderStatusLabel(status: RecentOrderStatus) {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'expired':
        return 'Expired';
      case 'cancelled':
        return 'Cancelled';
      case 'refunded':
        return 'Refunded';
    }
  }
</script>

<svelte:head>
  <title>Seller Dashboard | Jeevatix</title>
  <meta
    name="description"
    content="Pantau total event, revenue, tiket terjual, event mendatang, pesanan terbaru, dan tren penjualan 30 hari seller Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div class="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white/92 shadow-[0_30px_90px_rgba(5,46,34,0.10)]">
    <div class="grid gap-8 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_38%),linear-gradient(135deg,rgba(15,118,110,0.08),rgba(255,255,255,0.96)_44%,rgba(245,158,11,0.10)_100%)] p-8 sm:p-10 xl:grid-cols-[1.15fr_0.85fr]">
      <div class="space-y-4">
        <p class="text-sm font-semibold tracking-[0.35em] text-emerald-800/70 uppercase">S5</p>
        <h1 class="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Seller Dashboard
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Lihat performa penjualan, pantau order terbaru, dan baca ritme demand tiket dalam 30 hari terakhir dari satu control room.
        </p>
      </div>

      <div class="rounded-[1.75rem] border border-emerald-950/10 bg-slate-950 p-6 text-white shadow-[0_20px_50px_rgba(15,23,42,0.25)]">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-emerald-100/75">30-Day Pulse</p>
            <p class="mt-3 text-4xl font-semibold">{totalSalesInWindow}</p>
            <p class="mt-2 text-sm leading-6 text-emerald-50/70">
              tiket terjual dalam 30 hari terakhir, memberi gambaran pace penjualan lintas event.
            </p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/8 p-3">
            <ChartSpline class="size-5 text-emerald-300" />
          </div>
        </div>

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl border border-white/10 bg-white/6 p-4">
            <p class="text-xs font-medium tracking-[0.25em] text-emerald-100/60 uppercase">Revenue</p>
            <p class="mt-2 text-lg font-semibold">{formatCurrency(dashboard?.total_revenue ?? 0)}</p>
          </div>
          <div class="rounded-2xl border border-white/10 bg-white/6 p-4">
            <p class="text-xs font-medium tracking-[0.25em] text-emerald-100/60 uppercase">Upcoming</p>
            <p class="mt-2 text-lg font-semibold">{dashboard?.upcoming_events ?? 0} event</p>
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

  <div class="grid gap-4 md:grid-cols-2">
    <div class="rounded-[1.7rem] border border-slate-200/80 bg-white p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-slate-500">Total Event</p>
          <p class="mt-3 text-3xl font-semibold text-slate-950">{dashboard?.total_events ?? 0}</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">Semua event yang saat ini dimiliki seller.</p>
        </div>
        <div class="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
          <CalendarRange class="size-5" />
        </div>
      </div>
    </div>

    <div class="rounded-[1.7rem] border border-slate-200/80 bg-white p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-slate-500">Total Revenue</p>
          <p class="mt-3 text-3xl font-semibold text-slate-950">{formatCurrency(dashboard?.total_revenue ?? 0)}</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">Akumulasi order confirmed dengan payment sukses.</p>
        </div>
        <div class="rounded-2xl bg-amber-50 p-3 text-amber-700">
          <Wallet class="size-5" />
        </div>
      </div>
    </div>

    <div class="rounded-[1.7rem] border border-slate-200/80 bg-white p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-slate-500">Total Tiket Terjual</p>
          <p class="mt-3 text-3xl font-semibold text-slate-950">{dashboard?.total_tickets_sold ?? 0}</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">Jumlah tiket dari transaksi sukses seluruh event seller.</p>
        </div>
        <div class="rounded-2xl bg-sky-50 p-3 text-sky-700">
          <Ticket class="size-5" />
        </div>
      </div>
    </div>

    <div class="rounded-[1.7rem] border border-slate-200/80 bg-white p-6 shadow-sm">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-medium text-slate-500">Event Mendatang</p>
          <p class="mt-3 text-3xl font-semibold text-slate-950">{dashboard?.upcoming_events ?? 0}</p>
          <p class="mt-2 text-sm leading-6 text-slate-500">Event future yang masih aktif dalam pipeline penjualan.</p>
        </div>
        <div class="rounded-2xl bg-rose-50 p-3 text-rose-700">
          <ReceiptText class="size-5" />
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
    <Card
      title="Pesanan terbaru"
      description="Lima order terakhir dari seluruh event seller. Klik order number untuk membuka detail order."
      class="rounded-[2rem] border border-slate-200/80 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
    >
      {#if !dashboard || dashboard.recent_orders.length === 0}
        <div class="flex min-h-72 items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Belum ada pesanan yang bisa ditampilkan.
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead>
              <tr class="text-slate-500">
                <th class="px-4 py-3 font-semibold">Order</th>
                <th class="px-4 py-3 font-semibold">Event</th>
                <th class="px-4 py-3 font-semibold">Buyer</th>
                <th class="px-4 py-3 font-semibold">Total</th>
                <th class="px-4 py-3 font-semibold">Status</th>
                <th class="px-4 py-3 font-semibold">Tanggal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              {#each dashboard.recent_orders as order (order.id)}
                <tr class="align-top hover:bg-slate-50/80">
                  <td class="px-4 py-4 font-medium text-slate-950">
                    <a
                      class="transition hover:text-emerald-700"
                      href={resolve(`/orders/${order.id}` as `/orders/${string}`)}
                    >
                      {order.order_number}
                    </a>
                  </td>
                  <td class="px-4 py-4 text-slate-700">{order.event_title}</td>
                  <td class="px-4 py-4 text-slate-700">{order.buyer_name}</td>
                  <td class="px-4 py-4 font-medium text-slate-950">{formatCurrency(order.total_amount)}</td>
                  <td class="px-4 py-4">
                    <Badge variant={getOrderStatusVariant(order.status)}>
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                  </td>
                  <td class="px-4 py-4 text-slate-700">{formatDate(order.created_at)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </Card>

    <Card
      title="Penjualan tiket per hari"
      description="Tren jumlah tiket terjual selama 30 hari terakhir."
      class="rounded-[2rem] border border-slate-200/80 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
    >
      <div class="rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,rgba(240,253,250,0.7),rgba(255,255,255,1))] p-4 sm:p-5">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          class="h-auto w-full overflow-visible"
          role="img"
          aria-label="Grafik penjualan tiket 30 hari terakhir"
        >
          <defs>
            <linearGradient id="seller-sales-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="rgba(16,185,129,0.32)"></stop>
              <stop offset="100%" stop-color="rgba(16,185,129,0.02)"></stop>
            </linearGradient>
          </defs>

          {#each yTicks as tick (tick)}
            {@const y = paddingTop + plotHeight - (tick / maxTicketsSold) * plotHeight}
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

          {#if areaPoints}
            <polyline
              points={areaPoints}
              fill="url(#seller-sales-area)"
              stroke="none"
            ></polyline>
          {/if}

          {#if chartPoints}
            <polyline
              points={chartPoints}
              fill="none"
              stroke="rgb(5,150,105)"
              stroke-width="4"
              stroke-linecap="round"
              stroke-linejoin="round"
            ></polyline>
          {/if}

          {#each sales as point, index (point.date)}
            {@const x =
              sales.length <= 1
                ? paddingLeft + plotWidth / 2
                : paddingLeft + (index * plotWidth) / (sales.length - 1)}
            {@const y = paddingTop + plotHeight - (point.tickets_sold / maxTicketsSold) * plotHeight}
            <circle cx={x} cy={y} r="4.5" fill="rgb(5,150,105)" stroke="white" stroke-width="2"></circle>
          {/each}
        </svg>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-medium tracking-[0.22em] text-slate-500 uppercase">
          {#each chartLabels as label (label.date)}
            <span>{formatDayLabel(label.date)}</span>
          {/each}
        </div>
      </div>

      <div class="mt-5 grid gap-3 sm:grid-cols-3">
        <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
          <p class="text-xs font-medium tracking-[0.24em] text-slate-500 uppercase">Window</p>
          <p class="mt-2 text-lg font-semibold text-slate-950">30 hari</p>
        </div>
        <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
          <p class="text-xs font-medium tracking-[0.24em] text-slate-500 uppercase">Peak Daily</p>
          <p class="mt-2 text-lg font-semibold text-slate-950">{maxTicketsSold} tiket</p>
        </div>
        <div class="rounded-[1.4rem] border border-slate-200 bg-slate-50/80 p-4">
          <p class="text-xs font-medium tracking-[0.24em] text-slate-500 uppercase">Total Sold</p>
          <p class="mt-2 text-lg font-semibold text-slate-950">{totalSalesInWindow} tiket</p>
        </div>
      </div>
    </Card>
  </div>
</section>
