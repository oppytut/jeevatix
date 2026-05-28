<script lang="ts">
  import { resolve } from '$app/paths';
  import { enhance } from '$app/forms';
  import { Button, Card, Input } from '@jeevatix/ui';
  import { KeyRound, Sparkles, TriangleAlert, Loader2 } from '@lucide/svelte';

  let { form }: import('./$types').PageProps = $props();
  let submitting = $state(false);
</script>

<svelte:head>
  <title>Login Buyer | Jeevatix</title>
  <meta
    name="description"
    content="Masuk ke akun buyer Jeevatix untuk menemukan event, menyimpan tiket, dan melanjutkan checkout dengan cepat."
  />
</svelte:head>

<section
  class="grid min-h-[calc(100vh-10rem)] items-center gap-8 py-6 lg:grid-cols-[1.08fr_0.92fr] lg:py-10"
>
  <div
    class="space-y-8 rounded-[2rem] border border-border bg-[linear-gradient(180deg,#fff8ef_0%,#fff1df_100%)] p-8 shadow-[0_30px_90px_rgba(249,115,22,0.12)] sm:p-10"
  >
    <div
      class="inline-flex w-fit items-center gap-3 rounded-full border border-orange-200 bg-card/80 px-4 py-2 text-sm font-semibold tracking-[0.26em] text-orange-700 uppercase"
    >
      <Sparkles class="size-4" />
      Discover Faster
    </div>

    <div class="space-y-4">
      <h1 class="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Satu akun untuk jelajah event, checkout, dan simpan tiketmu.
      </h1>
      <p class="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
        Buyer portal Jeevatix dirancang untuk flow yang cepat: cari event, bandingkan tier, dan
        lanjut ke pembelian tanpa friction berlebihan.
      </p>
    </div>

    <div class="grid gap-4 sm:grid-cols-3">
      <div class="rounded-[1.5rem] border border-orange-100 bg-card/70 p-4">
        <p class="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">Explore</p>
        <p class="mt-3 text-3xl font-semibold text-foreground">B7</p>
        <p class="mt-2 text-sm text-muted-foreground">
          Temukan event berdasarkan kota, kategori, dan tanggal.
        </p>
      </div>
      <div class="rounded-[1.5rem] border border-orange-100 bg-card/70 p-4">
        <p class="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">Checkout</p>
        <p class="mt-3 text-3xl font-semibold text-foreground">B10</p>
        <p class="mt-2 text-sm text-muted-foreground">
          Reservasi tiket dan lanjutkan ke pembayaran dengan cepat.
        </p>
      </div>
      <div class="rounded-[1.5rem] border border-orange-100 bg-card/70 p-4">
        <p class="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">Tickets</p>
        <p class="mt-3 text-3xl font-semibold text-foreground">B14</p>
        <p class="mt-2 text-sm text-muted-foreground">Simpan semua tiket aktif di satu dashboard buyer.</p>
      </div>
    </div>
  </div>

  <Card
    class="rounded-[2rem] border border-border bg-card/90 p-7 shadow-[0_26px_80px_rgba(15,23,42,0.10)] sm:p-9"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-2">
        <p class="text-sm font-semibold tracking-[0.3em] text-muted-foreground uppercase">Sign In</p>
        <h2 class="text-3xl font-semibold tracking-tight text-foreground">Masuk ke akun buyer</h2>
        <p class="text-sm leading-6 text-muted-foreground">
          Gunakan akun buyer untuk menyimpan order, tiket, dan progres pembelian Anda.
        </p>
      </div>

      <div
        class="flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"
      >
        <KeyRound class="size-7" />
      </div>
    </div>

    <form class="mt-8 space-y-5" method="POST" use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        submitting = false;
        await update();
      };
    }}>
      <div class="space-y-2">
        <label class="text-sm font-medium text-foreground" for="email">Email</label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="buyer@jeevatix.id"
          value={form?.values?.email ?? ''}
          autocomplete="email"
          required
        />
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-4">
          <label class="text-sm font-medium text-foreground" for="password">Password</label>
          <a
            class="text-sm font-medium text-orange-700 hover:text-orange-800"
            href={resolve('/forgot-password')}
          >
            Lupa password?
          </a>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Masukkan password"
          autocomplete="current-password"
          required
        />
      </div>

      {#if form?.error}
        <div
          class="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <TriangleAlert class="mt-0.5 size-4 shrink-0" />
          <p>{form.error}</p>
        </div>
      {/if}

      <Button class="w-full" type="submit" disabled={submitting}>
        {#if submitting}
          <Loader2 class="mr-2 size-4 animate-spin" />
          Memproses...
        {:else}
          Login
        {/if}
      </Button>
    </form>

    {#snippet footer()}
      <div class="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>Belum punya akun?</p>
        <a class="font-medium text-orange-700 hover:text-orange-800" href={resolve('/register')}>
          Buat akun buyer
        </a>
      </div>
    {/snippet}
  </Card>
</section>
