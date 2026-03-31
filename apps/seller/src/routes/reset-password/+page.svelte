<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { Button, Card, Input } from '@jeevatix/ui';
  import { LockKeyhole, TriangleAlert } from '@lucide/svelte';

  import { ApiError, resetPassword } from '$lib/auth';

  let password = $state('');
  let errorMessage = $state('');
  let successMessage = $state('');
  let isSubmitting = $state(false);

  const token = $derived(page.url.searchParams.get('token') ?? '');

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (isSubmitting || !token) {
      return;
    }

    errorMessage = '';
    successMessage = '';
    isSubmitting = true;

    try {
      const result = await resetPassword(token, password);
      successMessage = result.message;
      password = '';
      setTimeout(() => {
        goto(resolve('/login'));
      }, 1200);
    } catch (error) {
      errorMessage = error instanceof ApiError ? error.message : 'Gagal mengubah password.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Seller Reset Password | Jeevatix</title>
  <meta
    name="description"
    content="Atur ulang password akun seller Jeevatix dengan token reset yang valid."
  />
</svelte:head>

<section class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center py-8">
  <Card
    title={undefined}
    description={undefined}
    class="w-full rounded-[2rem] border border-emerald-200/70 bg-white/94 p-8 shadow-[0_28px_80px_rgba(6,78,59,0.10)] sm:p-10"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="space-y-2">
        <p class="text-sm font-semibold tracking-[0.32em] text-emerald-700/70 uppercase">New Password</p>
        <h1 class="text-3xl font-semibold tracking-tight text-slate-950">Buat password baru</h1>
        <p class="text-sm leading-6 text-slate-600">
          Gunakan password baru minimal 8 karakter untuk mengaktifkan kembali akses Seller Studio.
        </p>
      </div>
      <div class="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <LockKeyhole class="size-7" />
      </div>
    </div>

    {#if !token}
      <div class="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
        Token reset password tidak ditemukan. Buka ulang link dari email atau minta token baru.
      </div>
    {:else}
      <form class="mt-8 space-y-5" onsubmit={handleSubmit}>
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700" for="password">Password Baru</label>
          <Input id="password" type="password" bind:value={password} placeholder="Minimal 8 karakter" required />
        </div>

        {#if errorMessage}
          <div class="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <TriangleAlert class="mt-0.5 size-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        {/if}

        {#if successMessage}
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p>{successMessage}</p>
            <p class="mt-2">Mengalihkan ke halaman login...</p>
          </div>
        {/if}

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a class="text-sm font-medium text-emerald-700 hover:text-emerald-800" href={resolve('/login')}>
            Kembali ke login
          </a>
          <Button type="submit" disabled={isSubmitting}>
            {#if isSubmitting}
              Menyimpan...
            {:else}
              Simpan Password Baru
            {/if}
          </Button>
        </div>
      </form>
    {/if}
  </Card>
</section>