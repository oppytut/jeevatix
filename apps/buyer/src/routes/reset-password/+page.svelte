<script lang="ts">
  import { resolve } from '$app/paths';
  import { Button, Card, Input } from '@jeevatix/ui';
  import { LockKeyhole, TriangleAlert } from '@lucide/svelte';

  let { data, form }: import('./$types').PageProps = $props();
</script>

<svelte:head>
  <title>Reset Password | Jeevatix</title>
  <meta
    name="description"
    content="Buat password baru untuk akun buyer Jeevatix Anda dengan token reset yang valid."
  />
</svelte:head>

<section class="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center py-6 lg:py-10">
  <Card
    class="w-full rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_26px_80px_rgba(15,23,42,0.10)] sm:p-9"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-2">
        <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">
          Reset Password
        </p>
        <h1 class="text-3xl font-semibold tracking-tight text-slate-950">Buat password baru</h1>
        <p class="text-sm leading-6 text-slate-600">
          Token reset harus valid. Setelah berhasil, Anda bisa login kembali dengan password baru.
        </p>
      </div>
      <div class="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
        <LockKeyhole class="size-7" />
      </div>
    </div>

    {#if !data.token}
      <div
        class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700"
      >
        Token reset password tidak ditemukan. Gunakan link reset yang valid dari email atau halaman
        forgot password.
      </div>
    {:else}
      <form class="mt-8 space-y-5" method="POST">
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700" for="password">Password Baru</label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Minimal 8 karakter"
            autocomplete="new-password"
            required
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700" for="confirm_password"
            >Konfirmasi Password Baru</label
          >
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            placeholder="Ulangi password baru"
            autocomplete="new-password"
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

        {#if form?.success}
          <div
            class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800"
          >
            <p>{form.message}</p>
          </div>
        {/if}

        <Button class="w-full" type="submit">Simpan Password Baru</Button>
      </form>
    {/if}

    {#snippet footer()}
      <div class="flex items-center justify-between gap-4 text-sm text-slate-500">
        <p>Butuh masuk lagi ke akun Anda?</p>
        <a class="font-medium text-sky-700 hover:text-sky-800" href={resolve('/login')}
          >Kembali ke login</a
        >
      </div>
    {/snippet}
  </Card>
</section>
