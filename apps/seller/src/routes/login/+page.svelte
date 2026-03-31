<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { Button, Card, Input } from '@jeevatix/ui';
  import { KeyRound, TriangleAlert } from '@lucide/svelte';

  import { ApiError, login } from '$lib/auth';

  let email = $state('');
  let password = $state('');
  let errorMessage = $state('');
  let isSubmitting = $state(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    errorMessage = '';
    isSubmitting = true;

    try {
      await login(email.trim(), password);
      await goto(resolve('/'));
    } catch (error) {
      errorMessage = error instanceof ApiError ? error.message : 'Login gagal. Silakan coba lagi.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Seller Login | Jeevatix</title>
  <meta
    name="description"
    content="Masuk ke Seller Studio Jeevatix untuk mengelola event, penjualan tiket, dan operasional check-in."
  />
</svelte:head>

<section
  class="relative overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-white shadow-[0_30px_90px_rgba(6,78,59,0.12)]"
>
  <div
    class="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.22),_transparent_55%),linear-gradient(120deg,_rgba(22,163,74,0.16),_rgba(245,158,11,0.14))]"
  ></div>

  <div class="relative grid min-h-[calc(100vh-4rem)] gap-0 lg:grid-cols-[1.05fr_0.95fr]">
    <div
      class="flex flex-col justify-between bg-[linear-gradient(180deg,#052e2b_0%,#064e3b_52%,#022c22_100%)] px-8 py-10 text-emerald-50 sm:px-10 lg:px-12 lg:py-12"
    >
      <div class="space-y-6">
        <div
          class="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2"
        >
          <span class="size-2.5 rounded-full bg-amber-300"></span>
          <span class="text-xs font-semibold tracking-[0.35em] uppercase">Seller Studio</span>
        </div>

        <div class="space-y-4">
          <h1 class="max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
            Kelola event, order, dan check-in dari satu cockpit operasional.
          </h1>
          <p class="max-w-xl text-base leading-7 text-emerald-100/80 sm:text-lg">
            Portal seller dipisahkan untuk menjaga workflow publikasi event, pengelolaan tier tiket,
            dan operasional hari-H tetap fokus dan aman.
          </p>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-semibold tracking-[0.25em] text-emerald-200/70 uppercase">Events</p>
          <p class="mt-3 text-3xl font-semibold">S6</p>
          <p class="mt-2 text-sm text-emerald-100/75">Publikasikan dan kelola event seller.</p>
        </div>
        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-semibold tracking-[0.25em] text-emerald-200/70 uppercase">Orders</p>
          <p class="mt-3 text-3xl font-semibold">S11</p>
          <p class="mt-2 text-sm text-emerald-100/75">Pantau order masuk dan status pembayarannya.</p>
        </div>
        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-semibold tracking-[0.25em] text-emerald-200/70 uppercase">Check-in</p>
          <p class="mt-3 text-3xl font-semibold">S13</p>
          <p class="mt-2 text-sm text-emerald-100/75">Validasi tiket dengan alur check-in cepat.</p>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-center px-6 py-10 sm:px-8 lg:px-12">
      <Card
        title={undefined}
        description={undefined}
        class="w-full max-w-xl rounded-[2rem] border border-emerald-100 bg-white/92 p-7 shadow-[0_28px_80px_rgba(6,78,59,0.08)] sm:p-9"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <p class="text-sm font-semibold tracking-[0.32em] text-emerald-700/70 uppercase">Sign In</p>
            <h2 class="text-3xl font-semibold tracking-tight text-slate-950">Masuk ke Seller Studio</h2>
            <p class="text-sm leading-6 text-slate-600">
              Gunakan akun seller untuk mengelola event, tiket, dan notifikasi operasional.
            </p>
          </div>

          <div class="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <KeyRound class="size-7" />
          </div>
        </div>

        <form class="mt-8 space-y-5" onsubmit={handleSubmit}>
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700" for="email">Email</label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seller@jeevatix.id"
              bind:value={email}
              autocomplete="email"
              required
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-4">
              <label class="text-sm font-medium text-slate-700" for="password">Password</label>
              <a class="text-sm font-medium text-emerald-700 hover:text-emerald-800" href={resolve('/forgot-password')}>
                Lupa password?
              </a>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Masukkan password"
              bind:value={password}
              autocomplete="current-password"
              required
            />
          </div>

          {#if errorMessage}
            <div class="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <TriangleAlert class="mt-0.5 size-4 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          {/if}

          <Button class="w-full" type="submit" disabled={isSubmitting}>
            {#if isSubmitting}
              Memverifikasi...
            {:else}
              Login
            {/if}
          </Button>
        </form>

        {#snippet footer()}
          <div class="flex items-center justify-between gap-4 text-sm text-slate-500">
            <p>Belum punya akun seller?</p>
            <a class="font-medium text-emerald-700 hover:text-emerald-800" href={resolve('/register')}>
              Daftar sekarang
            </a>
          </div>
        {/snippet}
      </Card>
    </div>
  </div>
</section>