<script lang="ts">
  import { resolve } from '$app/paths';
  import { Building2, TriangleAlert } from '@lucide/svelte';
  import { Button, Card, Input } from '@jeevatix/ui';

  let { form }: import('./$types').PageProps = $props();
</script>

<svelte:head>
  <title>Seller Register | Jeevatix</title>
  <meta
    name="description"
    content="Daftar sebagai seller Jeevatix untuk membuat event, menjual tiket, dan mengelola operasional event Anda."
  />
</svelte:head>

<section class="mx-auto max-w-5xl py-6 sm:py-10">
  <Card
    title={undefined}
    description={undefined}
    class="overflow-hidden rounded-[2rem] border border-emerald-200/70 bg-white/94 shadow-[0_28px_80px_rgba(6,78,59,0.10)]"
  >
    <div class="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
      <div
        class="bg-[linear-gradient(180deg,#022c22_0%,#064e3b_100%)] px-8 py-10 text-emerald-50 sm:px-10"
      >
        <div class="space-y-5">
          <div
            class="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-amber-200"
          >
            <Building2 class="size-7" />
          </div>
          <div class="space-y-3">
            <p class="text-sm font-semibold tracking-[0.32em] text-emerald-200/70 uppercase">
              Create Seller Account
            </p>
            <h1 class="text-4xl font-semibold tracking-tight">Buka kanal penjualan event Anda.</h1>
            <p class="text-base leading-7 text-emerald-100/80">
              Lengkapi identitas pribadi dan organisasi untuk mulai membuat event, mengatur tier
              tiket, dan memantau order dari Seller Studio.
            </p>
          </div>
        </div>
      </div>

      <form class="space-y-5 px-8 py-10 sm:px-10" method="POST">
        <div class="grid gap-5 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <label class="text-sm font-medium text-slate-700" for="email">Email</label>
            <Input
              id="email"
              name="email"
              type="email"
              value={form?.values?.email ?? ''}
              placeholder="organizer@brand.id"
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
              required
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700" for="fullName">Nama Lengkap</label>
            <Input
              id="fullName"
              name="full_name"
              value={form?.values?.full_name ?? ''}
              placeholder="Nama PIC seller"
              required
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700" for="phone">Nomor Telepon</label>
            <Input
              id="phone"
              name="phone"
              value={form?.values?.phone ?? ''}
              placeholder="081234567890"
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <label class="text-sm font-medium text-slate-700" for="orgName">Nama Organisasi</label>
            <Input
              id="orgName"
              name="org_name"
              value={form?.values?.org_name ?? ''}
              placeholder="EventPro Indonesia"
              required
            />
          </div>
          <div class="space-y-2 sm:col-span-2">
            <label class="text-sm font-medium text-slate-700" for="orgDescription"
              >Deskripsi Organisasi</label
            >
            <textarea
              id="orgDescription"
              name="org_description"
              class="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="Ceritakan jenis event yang Anda kelola."
              >{form?.values?.org_description ?? ''}</textarea
            >
          </div>
        </div>

        {#if form?.error}
          <div
            class="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            <TriangleAlert class="mt-0.5 size-4 shrink-0" />
            <p>{form.error}</p>
          </div>
        {/if}

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-slate-500">
            Sudah punya akun?
            <a class="font-medium text-emerald-700 hover:text-emerald-800" href={resolve('/login')}
              >Masuk di sini</a
            >
          </p>
          <Button type="submit">Daftar Seller</Button>
        </div>
      </form>
    </div>
  </Card>
</section>
