<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ArrowRight,
    CalendarDays,
    Clock3,
    CreditCard,
    Landmark,
    ReceiptText,
    Smartphone,
    Wallet,
  } from '@lucide/svelte';

  import { Button, Card } from '@jeevatix/ui';

  import type { OrderDetail } from '$lib/api';
  import { formatCurrency, formatLongDateTime } from '$lib/utils';

  type PaymentData = {
    order: OrderDetail;
  };
  type PaymentForm = {
    paymentError?: string;
    paymentSuccess?: string;
    selectedMethod?: string;
  };

  let { data, form }: { data: PaymentData; form?: PaymentForm } = $props();

  let now = $state(Date.now());
  let countdownInterval: ReturnType<typeof setInterval> | null = null;
  let selectedMethod = $derived(
    form?.selectedMethod ?? data.order.payment.method ?? 'bank_transfer',
  );

  const paymentMethods = [
    {
      value: 'bank_transfer',
      label: 'Bank Transfer',
      description: 'Instruksi transfer manual ke rekening virtual penyelenggara.',
      icon: Landmark,
    },
    {
      value: 'e_wallet',
      label: 'E-Wallet',
      description: 'Bayar instan lewat dompet digital yang terhubung.',
      icon: Smartphone,
    },
    {
      value: 'credit_card',
      label: 'Credit Card',
      description: 'Gunakan kartu kredit untuk proses cepat dan aman.',
      icon: CreditCard,
    },
    {
      value: 'virtual_account',
      label: 'Virtual Account',
      description: 'Nomor VA otomatis untuk pembayaran bank tertentu.',
      icon: Wallet,
    },
  ] as const;

  function getRemainingMs() {
    return new Date(data.order.expires_at).getTime() - now;
  }

  function formatCountdown(ms: number) {
    const safeMs = Math.max(0, ms);
    const totalSeconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');

    return `${minutes}:${seconds}`;
  }

  function getStatusTone(status: string) {
    switch (status) {
      case 'confirmed':
        return 'bg-emerald-100 text-emerald-700';
      case 'expired':
        return 'bg-slate-200 text-slate-700';
      case 'cancelled':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-amber-100 text-amber-700';
    }
  }

  onMount(() => {
    countdownInterval = setInterval(() => {
      now = Date.now();
    }, 1000);

    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  });
</script>

<svelte:head>
  <title>Pembayaran {data.order.order_number} | Jeevatix</title>
  <meta
    name="description"
    content={`Selesaikan pembayaran untuk order ${data.order.order_number} di Jeevatix.`}
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div
    class="rounded-[2.5rem] border border-white/80 bg-[linear-gradient(135deg,#eef8ff_0%,#fff4e8_48%,#fffaf0_100%)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">Payment</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Selesaikan pembayaran order Anda.
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Pilih metode pembayaran yang paling nyaman, lalu lanjutkan ke gateway pembayaran mock
          Jeevatix.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-[1.5rem] border border-white/70 bg-white/75 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">
            Order Number
          </p>
          <p class="mt-2 text-sm font-medium text-slate-900">{data.order.order_number}</p>
        </div>
        <div class="rounded-[1.5rem] border border-white/70 bg-white/75 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Status</p>
          <p
            class={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusTone(data.order.status)}`}
          >
            {data.order.status}
          </p>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
    <Card
      class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
            Metode Pembayaran
          </p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Pilih cara bayar
          </h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Order ini akan kedaluwarsa pada {formatLongDateTime(data.order.expires_at)} jika belum dibayar.
          </p>
        </div>
        <div class="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <ReceiptText class="size-7" />
        </div>
      </div>

      <form class="mt-8 space-y-5" method="POST" action="?/initiatePayment">
        <div class="space-y-4">
          {#each paymentMethods as paymentMethod (paymentMethod.value)}
            <label
              class={`block cursor-pointer rounded-[1.75rem] border p-5 transition ${selectedMethod === paymentMethod.value ? 'border-sky-400 bg-sky-50/80 shadow-[0_16px_38px_rgba(14,165,233,0.12)]' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'}`}
            >
              <input
                class="sr-only"
                type="radio"
                name="method"
                value={paymentMethod.value}
                bind:group={selectedMethod}
                checked={selectedMethod === paymentMethod.value}
              />

              <div class="flex items-start gap-4">
                <div
                  class="flex size-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm"
                >
                  <paymentMethod.icon class="size-5" />
                </div>
                <div>
                  <p class="text-lg font-semibold text-slate-950">{paymentMethod.label}</p>
                  <p class="mt-1 text-sm leading-6 text-slate-600">{paymentMethod.description}</p>
                </div>
              </div>
            </label>
          {/each}
        </div>

        {#if form?.paymentError}
          <div
            class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {form.paymentError}
          </div>
        {/if}

        {#if form?.paymentSuccess}
          <div
            class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            {form.paymentSuccess}
          </div>
        {/if}

        <Button
          type="submit"
          class="w-full rounded-full px-6 py-3"
          disabled={getRemainingMs() <= 0 || data.order.status !== 'pending'}
        >
          Bayar Sekarang
          <ArrowRight class="size-4" />
        </Button>
      </form>
    </Card>

    <div class="space-y-6">
      <Card
        class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
          Batas Waktu Bayar
        </p>
        <div class="mt-5 rounded-[1.75rem] border border-amber-200 bg-amber-50 p-5">
          <div class="flex items-start gap-3">
            <Clock3 class="mt-0.5 size-5 text-amber-700" />
            <div>
              <p class="text-4xl font-semibold tracking-tight text-slate-950">
                {formatCountdown(getRemainingMs())}
              </p>
              <p class="mt-3 text-sm leading-6 text-slate-600">
                Selesaikan pembayaran sebelum {formatLongDateTime(data.order.expires_at)} agar order tidak
                hangus.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card
        class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
      >
        <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">
          Ringkasan Order
        </p>
        <div class="mt-5 space-y-4">
          <div
            class="flex items-start gap-3 rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600"
          >
            <CalendarDays class="mt-0.5 size-4 text-orange-600" />
            <div>
              <p class="font-medium text-slate-900">{data.order.event_title}</p>
              <p class="mt-1">Order dibuat {formatLongDateTime(data.order.created_at)}</p>
            </div>
          </div>

          <div class="space-y-3 rounded-[1.5rem] bg-slate-50 p-4">
            {#each data.order.items as item (item.id)}
              <div
                class="flex items-end justify-between gap-4 border-b border-slate-200 pb-3 last:border-b-0 last:pb-0"
              >
                <div>
                  <p class="font-medium text-slate-900">{item.tier_name}</p>
                  <p class="mt-1 text-sm text-slate-600">
                    {item.quantity} tiket x {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <p class="text-sm font-semibold text-slate-950">{formatCurrency(item.subtotal)}</p>
              </div>
            {/each}
          </div>

          <div class="rounded-[1.5rem] border border-slate-200 bg-white p-4">
            <div class="flex items-center justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(data.order.total_amount - data.order.service_fee)}</span>
            </div>
            <div class="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span>Service Fee</span>
              <span>{formatCurrency(data.order.service_fee)}</span>
            </div>
            <div class="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span class="text-base font-medium text-slate-900">Total Bayar</span>
              <span class="text-2xl font-semibold text-slate-950"
                >{formatCurrency(data.order.total_amount)}</span
              >
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</section>
