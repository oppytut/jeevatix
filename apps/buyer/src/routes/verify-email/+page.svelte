<script lang="ts">
  import { resolve } from '$app/paths';
  import { Button, Card } from '@jeevatix/ui';
  import { BadgeCheck, CircleX } from '@lucide/svelte';

  let { data }: import('./$types').PageProps = $props();
</script>

<svelte:head>
  <title>Verify Email | Jeevatix</title>
  <meta name="description" content="Konfirmasi status verifikasi email akun buyer Jeevatix Anda." />
</svelte:head>

<section class="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center py-6 lg:py-10">
  <Card
    class="w-full rounded-[2rem] border border-white/80 bg-white/92 p-8 text-center shadow-[0_26px_80px_rgba(15,23,42,0.10)] sm:p-10"
  >
    <div
      class="mx-auto flex size-18 items-center justify-center rounded-full {data.success
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-rose-100 text-rose-700'}"
    >
      {#if data.success}
        <BadgeCheck class="size-9" />
      {:else}
        <CircleX class="size-9" />
      {/if}
    </div>

    <div class="mt-6 space-y-3">
      <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">
        Email Verification
      </p>
      <h1 class="text-3xl font-semibold tracking-tight text-slate-950">
        {#if data.success}
          Email berhasil diverifikasi
        {:else}
          Verifikasi email belum berhasil
        {/if}
      </h1>
      <p class="mx-auto max-w-xl text-base leading-7 text-slate-600">{data.message}</p>
    </div>

    <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
      <a href={resolve('/login')}>
        <Button type="button" class="w-full sm:w-auto">Ke Halaman Login</Button>
      </a>
      <a
        class="inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-slate-600 transition hover:text-slate-950"
        href={resolve('/')}
      >
        Kembali ke Beranda
      </a>
    </div>
  </Card>
</section>
