<script lang="ts">
  import { resolve } from '$app/paths';
  import { enhance } from '$app/forms';
  import { Button, Card, Input } from '@jeevatix/ui';
  import { Ticket, TriangleAlert, Loader2 } from '@lucide/svelte';

  let { form }: import('./$types').PageProps = $props();
  let submitting = $state(false);
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
    class="rounded-[2rem] border border-sky-200/80 bg-[var(--gradient-section)] p-8 shadow-[0_28px_90px_rgba(14,165,233,0.12)] sm:p-10"
  >
    <div class="bg-card/70 flex size-14 items-center justify-center rounded-2xl text-sky-700">
      <Ticket class="size-7" />
    </div>
    <div class="mt-6 space-y-4">
      <p class="text-sm font-semibold tracking-[0.3em] text-sky-700 uppercase">Create Account</p>
      <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
        Buat akun untuk checkout lebih cepat saat event incaran sudah tayang.
      </h1>
      <p class="text-muted-foreground text-base leading-7 sm:text-lg">
        Dengan akun buyer, Anda bisa melanjutkan pembelian lebih cepat, melacak order, dan menyimpan
        semua tiket di satu tempat.
      </p>
    </div>
  </div>

  <Card
    class="border-border bg-card/90 rounded-[2rem] border p-7 shadow-[0_26px_80px_rgba(15,23,42,0.10)] sm:p-9"
  >
    <div class="space-y-2">
      <p class="text-muted-foreground text-sm font-semibold tracking-[0.3em] uppercase">
        Buyer Registration
      </p>
      <h2 class="text-foreground text-3xl font-semibold tracking-tight">Daftar akun buyer baru</h2>
      <p class="text-muted-foreground text-sm leading-6">
        Isi detail dasar Anda untuk mulai jelajah event dan menyimpan progres pembelian.
      </p>
    </div>

    <form
      class="mt-8 grid gap-5 sm:grid-cols-2"
      method="POST"
      use:enhance={() => {
        submitting = true;
        return async ({ update }) => {
          submitting = false;
          await update();
        };
      }}
    >
      <div class="space-y-2 sm:col-span-2">
        <label class="text-foreground text-sm font-medium" for="email">Email</label>
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
        <label class="text-foreground text-sm font-medium" for="password">Password</label>
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
        <label class="text-foreground text-sm font-medium" for="full_name">Nama Lengkap</label>
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
        <label class="text-foreground text-sm font-medium" for="phone">Nomor Telepon</label>
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
        <p class="text-muted-foreground text-sm">
          Sudah punya akun?
          <a class="font-medium text-sky-700 hover:text-sky-800" href={resolve('/login')}
            >Masuk di sini</a
          >
        </p>
        <Button type="submit" disabled={submitting}>
          {#if submitting}
            <Loader2 class="mr-2 size-4 animate-spin" />
            Memproses...
          {:else}
            Daftar Sekarang
          {/if}
        </Button>
      </div>
    </form>
  </Card>
</section>
