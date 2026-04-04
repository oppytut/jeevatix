<script lang="ts">
  import { resolve } from '$app/paths';
  import { Button, Card, Input } from '@jeevatix/ui';
  import { Ticket, TriangleAlert } from '@lucide/svelte';

  let { form }: import('./$types').PageProps = $props();
</script>

<svelte:head>
  <title>Register Buyer | Jeevatix</title>
  <meta
    name="description"
    content="Buat akun buyer Jeevatix untuk mulai menjelajahi event, reservasi tiket, dan menyimpan order Anda."
  />
</svelte:head>

<section class="grid gap-8 py-6 lg:grid-cols-[0.92fr_1.08fr] lg:py-10">
  <div
    class="rounded-[2rem] border border-sky-200/80 bg-[linear-gradient(180deg,#f0f9ff_0%,#e0f2fe_100%)] p-8 shadow-[0_28px_90px_rgba(14,165,233,0.12)] sm:p-10"
  >
    <div class="flex size-14 items-center justify-center rounded-2xl bg-white/70 text-sky-700">
      <Ticket class="size-7" />
    </div>
    <div class="mt-6 space-y-4">
      <p class="text-sm font-semibold tracking-[0.3em] text-sky-700 uppercase">Create Account</p>
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Buat akun untuk checkout lebih cepat saat event incaran sudah tayang.
      </h1>
      <p class="text-base leading-7 text-slate-600 sm:text-lg">
        Dengan akun buyer, Anda bisa melanjutkan pembelian lebih cepat, melacak order, dan menyimpan
        semua tiket di satu tempat.
      </p>
    </div>
  </div>

  <Card
    class="rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_26px_80px_rgba(15,23,42,0.10)] sm:p-9"
  >
    <div class="space-y-2">
      <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">
        Buyer Registration
      </p>
      <h2 class="text-3xl font-semibold tracking-tight text-slate-950">Daftar akun buyer baru</h2>
      <p class="text-sm leading-6 text-slate-600">
        Isi detail dasar Anda untuk mulai jelajah event dan menyimpan progres pembelian.
      </p>
    </div>

    <form class="mt-8 grid gap-5 sm:grid-cols-2" method="POST">
      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium text-slate-700" for="email">Email</label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="nama@domain.com"
          value={form?.values?.email ?? ''}
          autocomplete="email"
          required
        />
      </div>

      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium text-slate-700" for="password">Password</label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Minimal 8 karakter"
          autocomplete="new-password"
          required
        />
      </div>

      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium text-slate-700" for="full_name">Nama Lengkap</label>
        <Input
          id="full_name"
          name="full_name"
          placeholder="Nama lengkap"
          value={form?.values?.full_name ?? ''}
          autocomplete="name"
          required
        />
      </div>

      <div class="space-y-2 sm:col-span-2">
        <label class="text-sm font-medium text-slate-700" for="phone">Nomor Telepon</label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          placeholder="081234567890"
          value={form?.values?.phone ?? ''}
          autocomplete="tel"
        />
      </div>

      {#if form?.error}
        <div
          class="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:col-span-2"
        >
          <TriangleAlert class="mt-0.5 size-4 shrink-0" />
          <p>{form.error}</p>
        </div>
      {/if}

      <div class="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-500">
          Sudah punya akun?
          <a class="font-medium text-sky-700 hover:text-sky-800" href={resolve('/login')}
            >Masuk di sini</a
          >
        </p>
        <Button type="submit">Daftar Sekarang</Button>
      </div>
    </form>
  </Card>
</section>
