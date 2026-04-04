<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';
  import { onMount } from 'svelte';
  import { ArrowLeft, Ban, RefreshCw, RotateCcw } from '@lucide/svelte';
  import { Badge, Button, Card, Modal, Toast } from '@jeevatix/ui';

  import { apiGet, apiPost, ApiError } from '$lib/api';

  type OrderStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
  type PaymentMethod = 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
  type TicketStatus = 'valid' | 'used' | 'cancelled' | 'refunded';

  type AdminOrderDetail = {
    id: string;
    reservationId: string | null;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: number;
    serviceFee: number;
    createdAt: string;
    updatedAt: string;
    confirmedAt: string | null;
    expiresAt: string;
    buyer: {
      id: string;
      fullName: string;
      email: string;
      phone: string | null;
    };
    event: {
      id: string;
      title: string;
      slug: string;
      venueCity: string;
      startAt: string;
    };
    payment: {
      id: string;
      method: PaymentMethod;
      status: PaymentStatus;
      amount: number;
      externalRef: string | null;
      paidAt: string | null;
      createdAt: string;
      updatedAt: string;
    };
    items: Array<{
      id: string;
      ticketTierId: string;
      tierName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
    tickets: Array<{
      id: string;
      ticketTierId: string;
      ticketTierName: string;
      ticketCode: string;
      status: TicketStatus;
      issuedAt: string;
      checkedInAt: string | null;
    }>;
  };

  type OrderActionPayload = {
    id: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    updatedAt: string;
  };

  type PendingAction = 'refund' | 'cancel';

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  let { params }: PageProps = $props();

  let orderDetail = $state<AdminOrderDetail | null>(null);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let isSubmitting = $state(false);
  let pageError = $state('');
  let pendingAction = $state<PendingAction | null>(null);
  let isConfirmOpen = $state(false);
  let toast = $state<ToastState | null>(null);

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3500);
  }

  function formatDate(value: string | null) {
    if (!value) {
      return ' - ';
    }

    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatOrderStatus(status: OrderStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function formatPaymentStatus(status: PaymentStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function formatPaymentMethod(method: PaymentMethod) {
    switch (method) {
      case 'bank_transfer':
        return 'Bank Transfer';
      case 'credit_card':
        return 'Credit Card';
      case 'virtual_account':
        return 'Virtual Account';
      default:
        return 'E-Wallet';
    }
  }

  function getOrderVariant(status: OrderStatus): 'default' | 'success' | 'neutral' | 'warning' {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'cancelled':
      case 'expired':
      case 'refunded':
        return 'neutral';
    }
  }

  function getPaymentVariant(status: PaymentStatus): 'default' | 'success' | 'neutral' | 'warning' {
    switch (status) {
      case 'success':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
      case 'refunded':
        return 'neutral';
    }
  }

  function getTicketVariant(status: TicketStatus): 'default' | 'success' | 'neutral' | 'warning' {
    switch (status) {
      case 'valid':
        return 'success';
      case 'used':
        return 'default';
      case 'cancelled':
      case 'refunded':
        return 'neutral';
    }
  }

  async function loadOrderDetail(showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      orderDetail = await apiGet<AdminOrderDetail>(`/admin/orders/${params.id}`);
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat detail pesanan.';
      orderDetail = null;
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function requestAction(action: PendingAction) {
    pendingAction = action;
    isConfirmOpen = true;
  }

  async function confirmAction() {
    if (!orderDetail || !pendingAction || isSubmitting) {
      return;
    }

    isSubmitting = true;

    try {
      const result = await apiPost<OrderActionPayload>(
        `/admin/orders/${orderDetail.id}/${pendingAction}`,
      );

      orderDetail = {
        ...orderDetail,
        status: result.status,
        updatedAt: result.updatedAt,
        payment: {
          ...orderDetail.payment,
          status: result.paymentStatus,
          updatedAt: result.updatedAt,
        },
        tickets: orderDetail.tickets.map((ticket) => ({
          ...ticket,
          status:
            pendingAction === 'refund'
              ? 'refunded'
              : pendingAction === 'cancel'
                ? 'cancelled'
                : ticket.status,
        })),
      };

      isConfirmOpen = false;
      setToast({
        title: pendingAction === 'refund' ? 'Order direfund' : 'Order dibatalkan',
        description:
          pendingAction === 'refund'
            ? `Order ${orderDetail.orderNumber} berhasil direfund.`
            : `Order ${orderDetail.orderNumber} berhasil dibatalkan.`,
        variant: 'success',
      });
    } catch (error) {
      setToast({
        title: 'Aksi order gagal',
        description: error instanceof ApiError ? error.message : 'Perubahan order gagal diproses.',
        variant: 'warning',
      });
    } finally {
      isSubmitting = false;
      pendingAction = null;
    }
  }

  const totalTickets = $derived(
    orderDetail ? orderDetail.items.reduce((total, item) => total + item.quantity, 0) : 0,
  );

  onMount(async () => {
    await loadOrderDetail();
  });
</script>

<svelte:head>
  <title>Order Detail | Jeevatix Admin</title>
  <meta
    name="description"
    content="Review detail pesanan, buyer, item tiket, dan lakukan refund atau cancel dari admin portal Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-4 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A10</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Detail pesanan
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Audit status order, pembayaran, tiket terbit, dan jalankan intervensi administratif bila
        dibutuhkan.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" type="button" onclick={() => goto(resolve('/orders'))}>
        <ArrowLeft class="mr-2 size-4" />
        Kembali ke daftar
      </Button>
      <Button
        variant="outline"
        type="button"
        onclick={() => loadOrderDetail(true)}
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

  {#if pageError}
    <Toast
      title="Gagal memuat detail"
      description={pageError}
      actionLabel={undefined}
      variant="warning"
    />
  {/if}

  {#if isLoading}
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {#each Array.from({ length: 4 }) as _, index (index)}
        <div class="h-28 animate-pulse rounded-[1.5rem] border border-slate-200 bg-slate-100"></div>
      {/each}
    </div>
  {:else if orderDetail}
    <div class="grid gap-4 md:grid-cols-4">
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
      >
        <p class="text-sm text-slate-500">Status order</p>
        <div class="mt-3">
          <Badge variant={getOrderVariant(orderDetail.status)}
            >{formatOrderStatus(orderDetail.status)}</Badge
          >
        </div>
      </Card>
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
      >
        <p class="text-sm text-slate-500">Status pembayaran</p>
        <div class="mt-3">
          <Badge variant={getPaymentVariant(orderDetail.payment.status)}>
            {formatPaymentStatus(orderDetail.payment.status)}
          </Badge>
        </div>
      </Card>
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
      >
        <p class="text-sm text-slate-500">Nilai transaksi</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">
          {formatCurrency(orderDetail.totalAmount)}
        </p>
      </Card>
      <Card
        title={undefined}
        description={undefined}
        class="rounded-[1.75rem] border border-slate-200/80 bg-white/90"
      >
        <p class="text-sm text-slate-500">Jumlah tiket</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">{totalTickets}</p>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card
        title="Ringkasan transaksi"
        description="Konteks utama order, event yang dibeli, dan detail buyer."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <p class="text-sm text-slate-500">Order number</p>
            <p class="mt-2 text-lg font-semibold text-slate-950">{orderDetail.orderNumber}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Reservation ID</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {orderDetail.reservationId ?? ' - '}
            </p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Buyer</p>
            <p class="mt-2 text-base font-medium text-slate-900">{orderDetail.buyer.fullName}</p>
            <p class="mt-1 text-sm text-slate-600">{orderDetail.buyer.email}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Event</p>
            <p class="mt-2 text-base font-medium text-slate-900">{orderDetail.event.title}</p>
            <p class="mt-1 text-sm text-slate-600">{orderDetail.event.venueCity}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Dibuat</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {formatDate(orderDetail.createdAt)}
            </p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Confirmed at</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {formatDate(orderDetail.confirmedAt)}
            </p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Expires at</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {formatDate(orderDetail.expiresAt)}
            </p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Service fee</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {formatCurrency(orderDetail.serviceFee)}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Aksi admin"
        description="Refund hanya untuk order confirmed dan paid. Cancel hanya untuk order yang belum sukses dibayar."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-4">
          <button
            type="button"
            class="w-full rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-white"
            onclick={() => requestAction('refund')}
          >
            <div class="flex items-center justify-between gap-3">
              <p class="font-semibold text-slate-950">Refund order</p>
              <RotateCcw class="size-5 text-slate-500" />
            </div>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              Gunakan ketika pembayaran sudah sukses dan transaksi harus dikembalikan.
            </p>
          </button>

          <button
            type="button"
            class="w-full rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-white"
            onclick={() => requestAction('cancel')}
          >
            <div class="flex items-center justify-between gap-3">
              <p class="font-semibold text-slate-950">Cancel order</p>
              <Ban class="size-5 text-slate-500" />
            </div>
            <p class="mt-2 text-sm leading-6 text-slate-600">
              Gunakan untuk order yang masih pending, expired, atau gagal dibayar.
            </p>
          </button>
        </div>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card
        title="Pembayaran"
        description="Status payment record yang terhubung dengan order ini."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="grid gap-5 md:grid-cols-2">
          <div>
            <p class="text-sm text-slate-500">Payment ID</p>
            <p class="mt-2 text-base font-medium text-slate-900">{orderDetail.payment.id}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Metode</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {formatPaymentMethod(orderDetail.payment.method)}
            </p>
          </div>
          <div>
            <p class="text-sm text-slate-500">External ref</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {orderDetail.payment.externalRef ?? ' - '}
            </p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Paid at</p>
            <p class="mt-2 text-base font-medium text-slate-900">
              {formatDate(orderDetail.payment.paidAt)}
            </p>
          </div>
        </div>
      </Card>

      <Card
        title="Item pesanan"
        description="Komposisi tier tiket yang dibeli di transaksi ini."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-3">
          {#each orderDetail.items as item (item.id)}
            <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="font-semibold text-slate-950">{item.tierName}</p>
                  <p class="mt-1 text-sm text-slate-500">
                    Qty {item.quantity} x {formatCurrency(item.unitPrice)}
                  </p>
                </div>
                <p class="font-semibold text-slate-950">{formatCurrency(item.subtotal)}</p>
              </div>
            </div>
          {/each}
        </div>
      </Card>
    </div>

    <Card
      title="Tiket terbit"
      description="Status akhir tiket hasil order ini, termasuk tiket yang sudah check-in."
      class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
    >
      <div class="grid gap-4 lg:grid-cols-2">
        {#if orderDetail.tickets.length > 0}
          {#each orderDetail.tickets as ticket (ticket.id)}
            <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-5">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="font-semibold text-slate-950">{ticket.ticketTierName}</p>
                  <p class="mt-1 text-sm text-slate-500">{ticket.ticketCode}</p>
                </div>
                <Badge variant={getTicketVariant(ticket.status)}>{ticket.status}</Badge>
              </div>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p class="text-sm text-slate-500">Issued at</p>
                  <p class="mt-2 text-sm font-medium text-slate-900">
                    {formatDate(ticket.issuedAt)}
                  </p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">Checked in</p>
                  <p class="mt-2 text-sm font-medium text-slate-900">
                    {formatDate(ticket.checkedInAt)}
                  </p>
                </div>
              </div>
            </div>
          {/each}
        {:else}
          <p class="text-sm text-slate-500">Belum ada tiket terbit untuk order ini.</p>
        {/if}
      </div>
    </Card>
  {/if}

  <Modal
    open={isConfirmOpen}
    title={pendingAction === 'refund' ? 'Refund order' : 'Cancel order'}
    description="Aksi ini akan memperbarui status order, payment, dan tiket terkait."
    onClose={() => {
      isConfirmOpen = false;
      pendingAction = null;
    }}
    contentClass="max-w-xl"
  >
    <div class="space-y-6">
      <div
        class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-700"
      >
        Anda akan menjalankan aksi
        <span class="font-semibold"> {pendingAction === 'refund' ? 'refund' : 'cancel'}</span>
        untuk order <span class="font-semibold">{orderDetail?.orderNumber}</span>.
      </div>

      <div class="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          onclick={() => {
            isConfirmOpen = false;
            pendingAction = null;
          }}
        >
          Batal
        </Button>
        <Button type="button" onclick={confirmAction} disabled={isSubmitting || !pendingAction}>
          Konfirmasi aksi
        </Button>
      </div>
    </div>
  </Modal>
</section>
