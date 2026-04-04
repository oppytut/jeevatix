<script lang="ts">
  import { ShieldCheck, TriangleAlert } from '@lucide/svelte';
  import { Button, Card, Input } from '@jeevatix/ui';

  let { form }: import('./$types').PageProps = $props();
</script>

<svelte:head>
  <title>Admin Login | Jeevatix</title>
  <meta
    name="description"
    content="Masuk ke admin console Jeevatix untuk mengelola pengguna, kategori, transaksi, dan seller."
  />
</svelte:head>

<section
  class="relative overflow-hidden rounded-[2rem] border border-slate-200/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.12)]"
>
  <div
    class="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,_rgba(15,23,42,0.18),_transparent_55%),linear-gradient(120deg,_rgba(14,116,144,0.14),_rgba(251,191,36,0.12))]"
  ></div>

  <div class="relative grid min-h-[calc(100vh-4rem)] gap-0 lg:grid-cols-[1.05fr_0.95fr]">
    <div
      class="flex flex-col justify-between bg-slate-950 px-8 py-10 text-slate-50 sm:px-10 lg:px-12 lg:py-12"
    >
      <div class="space-y-6">
        <div
          class="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2"
        >
          <span class="size-2.5 rounded-full bg-emerald-400"></span>
          <span class="text-xs font-semibold tracking-[0.35em] uppercase">Jeevatix Admin</span>
        </div>

        <div class="space-y-4">
          <h1 class="max-w-lg text-4xl font-semibold tracking-tight sm:text-5xl">
            Kontrol operasional platform dari satu ruang kerja yang ketat.
          </h1>
          <p class="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
            Login admin dipisahkan dari portal buyer dan seller untuk menjaga review event, moderasi
            akun, serta monitoring transaksi tetap terpusat dan aman.
          </p>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase">Users</p>
          <p class="mt-3 text-3xl font-semibold">A3</p>
          <p class="mt-2 text-sm text-slate-300">Moderasi akun buyer, seller, dan admin.</p>
        </div>
        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase">Catalog</p>
          <p class="mt-3 text-3xl font-semibold">A13</p>
          <p class="mt-2 text-sm text-slate-300">Kelola kategori event dan kurasi listing.</p>
        </div>
        <div class="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
          <p class="text-xs font-semibold tracking-[0.25em] text-slate-400 uppercase">Payments</p>
          <p class="mt-3 text-3xl font-semibold">A11</p>
          <p class="mt-2 text-sm text-slate-300">Pantau order, pembayaran, dan reservasi.</p>
        </div>
      </div>
    </div>

    <div
      class="flex items-center justify-center bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,1))] px-6 py-10 sm:px-8 lg:px-12"
    >
      <Card
        title={undefined}
        description={undefined}
        class="w-full max-w-xl rounded-[2rem] border border-slate-200/80 bg-white/90 p-7 shadow-[0_28px_80px_rgba(15,23,42,0.08)] sm:p-9"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <p class="text-sm font-semibold tracking-[0.32em] text-slate-500 uppercase">Sign In</p>
            <h2 class="text-3xl font-semibold tracking-tight text-slate-950">
              Masuk ke admin console
            </h2>
            <p class="text-sm leading-6 text-slate-600">
              Gunakan akun admin yang memiliki akses ke dashboard internal Jeevatix.
            </p>
          </div>

          <div
            class="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"
          >
            <ShieldCheck class="size-7" />
          </div>
        </div>

        <form class="mt-8 space-y-5" method="POST">
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700" for="email">Email</label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="admin@jeevatix.id"
              value={form?.values?.email ?? ''}
              autocomplete="email"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700" for="password">Password</label>
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

          <Button class="w-full" type="submit">Login</Button>
        </form>

        {#snippet footer()}
          <div class="flex items-center justify-between gap-4 text-sm text-slate-500">
            <p>Portal ini khusus untuk administrator Jeevatix.</p>
            <p class="font-medium text-slate-700">localhost:4302</p>
          </div>
        {/snippet}
      </Card>
    </div>
  </div>
</section>
