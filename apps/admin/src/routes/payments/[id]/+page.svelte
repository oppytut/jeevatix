<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import type { PageProps } from './$types';
  import { onMount } from 'svelte';
  import { ArrowLeft, BadgeCheck, CircleX, RefreshCw } from '@lucide/svelte';
  import { Badge, Button, Card, Modal, Toast } from '@jeevatix/ui';

  import { apiGet, apiPatch, ApiError } from '$lib/api';

  type OrderStatus = 'pending' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
  type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';
  type PaymentMethod = 'bank_transfer' | 'e_wallet' | 'credit_card' | 'virtual_account';
  type TicketStatus = 'valid' | 'used' | 'cancelled' | 'refunded';

  type AdminPaymentDetail = {
    id: string;
    orderId: string;
    orderNumber: string;
    status: PaymentStatus;
    method: PaymentMethod;
    amount: number;
    externalRef: string | null;
    paidAt: string | null;
    createdAt: string;
    updatedAt: string;
    orderStatus: OrderStatus;
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

  type PaymentStatusPayload = {
    id: string;
    status: PaymentStatus;
    orderStatus: OrderStatus;
    paidAt: string | null;
    updatedAt: string;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  const statusActions: Array<{ status: PaymentStatus; label: string; description: string }> = [
    {
      status: 'success',
      label: 'Tandai sukses',
      description: 'Konfirmasi manual pembayaran dan ubah order menjadi confirmed.',
    },
    {
      status: 'failed',
      label: 'Tandai gagal',
      description: 'Gunakan untuk payment yang tidak valid atau tidak selesai diproses.',
    },
    {
      status: 'refunded',
      label: 'Refund payment',
      description: 'Kembalikan pembayaran yang sebelumnya sudah sukses diterima.',
    },
  ];

  let { params }: PageProps = $props();

  let paymentDetail = $state<AdminPaymentDetail | null>(null);
  let isLoading = $state(true);
  let isRefreshing = $state(false);
  let isSubmitting = $state(false);
  let pageError = $state('');
  let pendingStatus = $state<PaymentStatus | null>(null);
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

  function formatMethod(method: PaymentMethod) {
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

  function formatStatus(status: PaymentStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function formatOrderStatus(status: OrderStatus) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  function getPaymentVariant(
    status: PaymentStatus,
  ): 'default' | 'success' | 'neutral' | 'warning' {
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

  function getOrderVariant(status: OrderStatus): 'default' | 'success' | 'neutral' | 'warning' {
    switch (status) {
      case 'confirmed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'expired':
      case 'cancelled':
      case 'refunded':
        return 'neutral';
    }
  }

  async function loadPaymentDetail(showRefresh = false) {
    pageError = '';

    if (showRefresh) {
      isRefreshing = true;
    } else {
      isLoading = true;
    }

    try {
      paymentDetail = await apiGet<AdminPaymentDetail>(`/admin/payments/${params.id}`);
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat detail pembayaran.';
      paymentDetail = null;
    } finally {
      isLoading = false;
      isRefreshing = false;
    }
  }

  function requestStatusChange(status: PaymentStatus) {
    pendingStatus = status;
    isConfirmOpen = true;
  }

  async function confirmStatusChange() {
    if (!paymentDetail || !pendingStatus || isSubmitting) {
      return;
    }

    isSubmitting = true;

    try {
      const updated = await apiPatch<PaymentStatusPayload>(
        `/admin/payments/${paymentDetail.id}/status`,
        { status: pendingStatus },
      );

      paymentDetail = {
        ...paymentDetail,
        status: updated.status,
        orderStatus: updated.orderStatus,
        paidAt: updated.paidAt,
        updatedAt: updated.updatedAt,
        tickets:
          updated.status === 'refunded'
            ? paymentDetail.tickets.map((ticket) => ({ ...ticket, status: 'refunded' }))
            : paymentDetail.tickets,
      };
      isConfirmOpen = false;
      setToast({
        title: 'Status pembayaran diperbarui',
        description: `Payment ${paymentDetail.orderNumber} sekarang berstatus ${formatStatus(updated.status)}.`,
        variant: 'success',
      });
    } catch (error) {
      setToast({
        title: 'Gagal memperbarui pembayaran',
        description:
          error instanceof ApiError ? error.message : 'Perubahan status pembayaran gagal disimpan.',
        variant: 'warning',
      });
    } finally {
      isSubmitting = false;
      pendingStatus = null;
    }
  }

  const totalTickets = $derived(
    paymentDetail ? paymentDetail.items.reduce((total, item) => total + item.quantity, 0) : 0,
  );

  onMount(async () => {
    await loadPaymentDetail();
  });
</script>

<svelte:head>
  <title>Payment Detail | Jeevatix Admin</title>
  <meta
    name="description"
    content="Review payment, order terkait, item tiket, dan koreksi status pembayaran dari admin portal Jeevatix."
  />
</svelte:head>

<section class="space-y-8">
  <div
    class="flex flex-col gap-4 rounded-[2rem] border border-slate-200/80 bg-white/85 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur sm:p-10 lg:flex-row lg:items-end lg:justify-between"
  >
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">A12</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Detail pembayaran
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Rekonsiliasi payment, order terkait, dan tiket terbit sebelum menjalankan perubahan status manual.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button variant="outline" type="button" onclick={() => goto(resolve('/payments'))}>
        <ArrowLeft class="mr-2 size-4" />
        Kembali ke daftar
      </Button>
      <Button
        variant="outline"
        type="button"
        onclick={() => loadPaymentDetail(true)}
        disabled={isRefreshing || isLoading}
      >
        <RefreshCw class={`mr-2 size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </Button>
    </div>
  </div>

  {#if toast}
    <Toast actionLabel={undefined} title={toast.title} description={toast.description} variant={toast.variant} />
  {/if}

  {#if pageError}
    <Toast title="Gagal memuat detail" description={pageError} actionLabel={undefined} variant="warning" />
  {/if}

  {#if isLoading}
    <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {#each Array.from({ length: 4 }) as _, index (index)}
        <div class="h-28 animate-pulse rounded-[1.5rem] border border-slate-200 bg-slate-100"></div>
      {/each}
    </div>
  {:else if paymentDetail}
    <div class="grid gap-4 md:grid-cols-4">
      <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
        <p class="text-sm text-slate-500">Status payment</p>
        <div class="mt-3">
          <Badge variant={getPaymentVariant(paymentDetail.status)}>{formatStatus(paymentDetail.status)}</Badge>
        </div>
      </Card>
      <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
        <p class="text-sm text-slate-500">Status order</p>
        <div class="mt-3">
          <Badge variant={getOrderVariant(paymentDetail.orderStatus)}>{formatOrderStatus(paymentDetail.orderStatus)}</Badge>
        </div>
      </Card>
      <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
        <p class="text-sm text-slate-500">Nominal</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">{formatCurrency(paymentDetail.amount)}</p>
      </Card>
      <Card title={undefined} description={undefined} class="rounded-[1.75rem] border border-slate-200/80 bg-white/90">
        <p class="text-sm text-slate-500">Jumlah tiket</p>
        <p class="mt-2 text-3xl font-semibold text-slate-950">{totalTickets}</p>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card
        title="Ringkasan payment"
        description="Identitas payment, buyer, event, dan relasi ke order platform."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <p class="text-sm text-slate-500">Payment ID</p>
            <p class="mt-2 text-base font-medium text-slate-900">{paymentDetail.id}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Order number</p>
            <p class="mt-2 text-base font-medium text-slate-900">{paymentDetail.orderNumber}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Buyer</p>
            <p class="mt-2 text-base font-medium text-slate-900">{paymentDetail.buyer.fullName}</p>
            <p class="mt-1 text-sm text-slate-600">{paymentDetail.buyer.email}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Event</p>
            <p class="mt-2 text-base font-medium text-slate-900">{paymentDetail.event.title}</p>
            <p class="mt-1 text-sm text-slate-600">{paymentDetail.event.venueCity}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Metode</p>
            <p class="mt-2 text-base font-medium text-slate-900">{formatMethod(paymentDetail.method)}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">External ref</p>
            <p class="mt-2 text-base font-medium text-slate-900">{paymentDetail.externalRef ?? ' - '}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Dibuat</p>
            <p class="mt-2 text-base font-medium text-slate-900">{formatDate(paymentDetail.createdAt)}</p>
          </div>
          <div>
            <p class="text-sm text-slate-500">Paid at</p>
            <p class="mt-2 text-base font-medium text-slate-900">{formatDate(paymentDetail.paidAt)}</p>
          </div>
        </div>
      </Card>

      <Card
        title="Aksi status"
        description="Pilih status yang paling mencerminkan kondisi payment saat ini."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-3">
          {#each statusActions as action (action.status)}
            <button
              type="button"
              class="w-full rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-white"
              onclick={() => requestStatusChange(action.status)}
              disabled={action.status === paymentDetail.status}
            >
              <div class="flex items-center justify-between gap-3">
                <p class="font-semibold text-slate-950">{action.label}</p>
                <Badge variant={getPaymentVariant(action.status)}>{formatStatus(action.status)}</Badge>
              </div>
              <p class="mt-2 text-sm leading-6 text-slate-600">{action.description}</p>
            </button>
          {/each}
        </div>
      </Card>
    </div>

    <div class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card
        title="Item order"
        description="Komposisi tier tiket yang ditutup oleh payment ini."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-3">
          {#each paymentDetail.items as item (item.id)}
            <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="font-semibold text-slate-950">{item.tierName}</p>
                  <p class="mt-1 text-sm text-slate-500">Qty {item.quantity} x {formatCurrency(item.unitPrice)}</p>
                </div>
                <p class="font-semibold text-slate-950">{formatCurrency(item.subtotal)}</p>
              </div>
            </div>
          {/each}
        </div>
      </Card>

      <Card
        title="Tiket terbit"
        description="Status tiket yang berhubungan dengan payment ini."
        class="rounded-[2rem] border border-slate-200/80 bg-white/90 shadow-sm"
      >
        <div class="space-y-3">
          {#if paymentDetail.tickets.length > 0}
            {#each paymentDetail.tickets as ticket (ticket.id)}
              <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="font-semibold text-slate-950">{ticket.ticketTierName}</p>
                    <p class="mt-1 text-sm text-slate-500">{ticket.ticketCode}</p>
                  </div>
                  <Badge variant={ticket.status === 'valid' ? 'success' : 'neutral'}>
                    {ticket.status}
                  </Badge>
                </div>
                <p class="mt-3 text-sm text-slate-600">Issued at {formatDate(ticket.issuedAt)}</p>
              </div>
            {/each}
          {:else}
            <p class="text-sm text-slate-500">Belum ada tiket terbit untuk payment ini.</p>
          {/if}
        </div>
      </Card>
    </div>
  {/if}

  <Modal
    open={isConfirmOpen}
    title="Ubah status payment"
    description="Perubahan ini akan ikut menyesuaikan status order bila diperlukan oleh backend."
    onClose={() => {
      isConfirmOpen = false;
      pendingStatus = null;
    }}
    contentClass="max-w-xl"
  >
    <div class="space-y-6">
      <div class="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4 text-sm leading-6 text-slate-700">
        Anda akan mengubah payment <span class="font-semibold">{paymentDetail?.orderNumber}</span> menjadi
        <span class="font-semibold"> {pendingStatus ? formatStatus(pendingStatus) : '-'}</span>.
      </div>

      <div class="flex items-center justify-end gap-3">
        <Button
          variant="outline"
          type="button"
          onclick={() => {
            isConfirmOpen = false;
            pendingStatus = null;
          }}
        >
          <CircleX class="mr-2 size-4" />
          Batal
        </Button>
        <Button type="button" onclick={confirmStatusChange} disabled={isSubmitting || !pendingStatus}>
          <BadgeCheck class="mr-2 size-4" />
          Simpan status
        </Button>
      </div>
    </div>
  </Modal>
</section>