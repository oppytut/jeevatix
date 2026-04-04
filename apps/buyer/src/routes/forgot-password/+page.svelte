<script lang="ts">
  import { resolve } from '$app/paths';
  import { Button, Card, Input } from '@jeevatix/ui';
  import { MailSearch, TriangleAlert } from '@lucide/svelte';

  let { form }: import('./$types').PageProps = $props();
</script>

<svelte:head>
  <title>Forgot Password | Jeevatix</title>
  <meta name="description" content="Minta token reset password untuk akun buyer Jeevatix Anda." />
</svelte:head>

<section class="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center py-6 lg:py-10">
  <Card
    class="w-full rounded-[2rem] border border-white/80 bg-white/90 p-7 shadow-[0_26px_80px_rgba(15,23,42,0.10)] sm:p-9"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-2">
        <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">
          Password Recovery
        </p>
        <h1 class="text-3xl font-semibold tracking-tight text-slate-950">
          Lupa password akun buyer?
        </h1>
        <p class="text-sm leading-6 text-slate-600">
          Masukkan email akun Anda. Jeevatix akan mengirim token reset untuk membuat password baru.
        </p>
      </div>
      <div class="flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
        <MailSearch class="size-7" />
      </div>
    </div>

    <form class="mt-8 space-y-5" method="POST">
      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="email">Email</label>
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
          class="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800"
        >
          <p>{form.message}</p>
          {#if form.resetToken}
            <div class="rounded-xl bg-white/80 p-3 font-mono text-xs break-all text-emerald-900">
              {form.resetToken}
            </div>
          {/if}
        </div>
      {/if}

      <Button class="w-full" type="submit">Kirim Instruksi Reset</Button>
    </form>

    {#snippet footer()}
      <div class="flex items-center justify-between gap-4 text-sm text-slate-500">
        <p>Sudah ingat password Anda?</p>
        <a class="font-medium text-amber-700 hover:text-amber-800" href={resolve('/login')}
          >Kembali ke login</a
        >
      </div>
    {/snippet}
  </Card>
</section>
