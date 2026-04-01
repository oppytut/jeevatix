<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { CalendarClock, ChevronLeft, ReceiptText, UserRound, Wallet } from '@lucide/svelte';
  import { Badge, Button, Card, Toast } from '@jeevatix/ui';

  import { ApiError, apiGet } from '$lib/api';

  type SellerOrderDetail = {
    id: string;
    order_number: string;
    status: 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
    total_amount: number;
    service_fee: number;
    expires_at: string;
    confirmed_at: string | null;
    created_at: string;
    updated_at: string;
    buyer: {
      id: string;
      full_name: string;
      email: string;
      phone: string | null;
    };
    event: {
      id: string;
      title: string;
      slug: string;
      start_at: string;
      venue_city: string;
    };
    items: Array<{
      id: string;
      ticket_tier_id: string;
      tier_name: string;
      quantity: number;
      unit_price: number;
      subtotal: number;
    }>;
    payment: {
      id: string;
      method: 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
      status: 'pending' | 'success' | 'failed' | 'refunded';
      amount: number;
      external_ref: string | null;
      paid_at: string | null;
      created_at: string;
      updated_at: string;
    };
  };

  const orderId = $derived(page.params.id ?? '');

  let order = $state<SellerOrderDetail | null>(null);
  let isLoading = $state(true);
  let pageError = $state('');

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatDate(value: string | null) {
    if (!value) {
      return '-';
    }

    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function getStatusVariant(status: SellerOrderDetail['status']) {
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

  function getPaymentVariant(status: SellerOrderDetail['payment']['status']) {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'warning';
      case 'refunded':
        return 'neutral';
      default:
        return 'default';
    }
  }

  async function loadOrder() {
    isLoading = true;
    pageError = '';

    try {
      order = await apiGet<SellerOrderDetail>(`/seller/orders/${orderId}`);
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat detail order seller.';
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    void loadOrder();
  });
</script>

<svelte:head>
  <title>Seller Order Detail | Jeevatix</title>
  <meta
    name="description"
    content="Lihat detail lengkap order seller, buyer info, item tiket, dan status pembayaran dalam satu halaman."
  />
</svelte:head>

<section class="space-y-8">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">S12</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">Detail pesanan seller</h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Audit detail transaksi, profil buyer, item tiket yang dibeli, dan progres pembayaran untuk order ini.
      </p>
    </div>

    <Button variant="outline" type="button" onclick={() => goto(resolve('/orders'))}>
      <ChevronLeft class="mr-2 size-4" />
      Kembali ke daftar order
    </Button>
  </div>

  {#if pageError}
    <Toast title="Gagal memuat order" description={pageError} variant="warning" actionLabel={undefined} />
  {/if}

  {#if isLoading}
    <Card title="Memuat order" description="Mohon tunggu, data transaksi seller sedang dipersiapkan.">
      <div class="py-16 text-center text-sm text-slate-500">Memuat detail pesanan...</div>
    </Card>
  {:else if order}
    <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div class="space-y-6">
        <Card
          title={order.order_number}
          description="Ringkasan utama order yang masuk ke event seller Anda."
          class="rounded-[2rem] border-slate-200 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
        >
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                <Badge variant={getPaymentVariant(order.payment.status)}>{order.payment.status}</Badge>
              </div>
              <div class="text-sm text-slate-600">
                <p><span class="font-medium text-slate-900">Event:</span> {order.event.title}</p>
                <p><span class="font-medium text-slate-900">Venue:</span> {order.event.venue_city}</p>
                <p><span class="font-medium text-slate-900">Mulai event:</span> {formatDate(order.event.start_at)}</p>
              </div>
            </div>

            <div class="space-y-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <div class="flex items-center justify-between text-sm text-slate-600">
                <span>Total amount</span>
                <span class="font-semibold text-slate-950">{formatCurrency(order.total_amount)}</span>
              </div>
              <div class="flex items-center justify-between text-sm text-slate-600">
                <span>Service fee</span>
                <span class="font-semibold text-slate-950">{formatCurrency(order.service_fee)}</span>
              </div>
              <div class="flex items-center justify-between text-sm text-slate-600">
                <span>Dibuat</span>
                <span class="font-semibold text-slate-950">{formatDate(order.created_at)}</span>
              </div>
              <div class="flex items-center justify-between text-sm text-slate-600">
                <span>Paid at</span>
                <span class="font-semibold text-slate-950">{formatDate(order.payment.paid_at)}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Item tiket"
          description="Rincian tier, kuantitas, harga per tiket, dan subtotal transaksi."
          class="rounded-[2rem] border-slate-200 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
        >
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead>
                <tr class="text-slate-500">
                  <th class="px-4 py-3 font-semibold">Tier</th>
                  <th class="px-4 py-3 font-semibold">Qty</th>
                  <th class="px-4 py-3 font-semibold">Unit Price</th>
                  <th class="px-4 py-3 font-semibold">Subtotal</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {#each order.items as item (item.id)}
                  <tr>
                    <td class="px-4 py-4 font-medium text-slate-900">{item.tier_name}</td>
                    <td class="px-4 py-4 text-slate-700">{item.quantity}</td>
                    <td class="px-4 py-4 text-slate-700">{formatCurrency(item.unit_price)}</td>
                    <td class="px-4 py-4 font-medium text-slate-900">{formatCurrency(item.subtotal)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div class="space-y-6">
        <Card
          title="Buyer info"
          description="Data pembeli untuk kebutuhan verifikasi operasional dan support."
          class="rounded-[2rem] border-slate-200 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
        >
          <div class="space-y-3 text-sm text-slate-600">
            <div class="flex items-start gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <UserRound class="mt-0.5 size-4 text-slate-400" />
              <div>
                <p class="font-semibold text-slate-950">{order.buyer.full_name}</p>
                <p>{order.buyer.email}</p>
                <p>{order.buyer.phone ?? 'Nomor telepon tidak tersedia'}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Payment info"
          description="Status pembayaran, channel yang dipilih, dan referensi eksternal dari gateway."
          class="rounded-[2rem] border-slate-200 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.06)]"
        >
          <div class="space-y-3 text-sm text-slate-600">
            <div class="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <Wallet class="size-4 text-slate-400" />
              <div>
                <p class="font-semibold text-slate-950">{order.payment.method}</p>
                <p>Status: {order.payment.status}</p>
                <p>Amount: {formatCurrency(order.payment.amount)}</p>
              </div>
            </div>

            <div class="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <ReceiptText class="size-4 text-slate-400" />
              <div>
                <p class="font-semibold text-slate-950">External Ref</p>
                <p>{order.payment.external_ref ?? '-'}</p>
              </div>
            </div>

            <div class="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
              <CalendarClock class="size-4 text-slate-400" />
              <div>
                <p class="font-semibold text-slate-950">Timeline</p>
                <p>Expires at: {formatDate(order.expires_at)}</p>
                <p>Confirmed at: {formatDate(order.confirmed_at)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  {/if}
</section>