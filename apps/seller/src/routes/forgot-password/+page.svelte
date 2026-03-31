<script lang="ts">
  import { resolve } from '$app/paths';
  import { Button, Card, Input } from '@jeevatix/ui';
  import { Mail, TriangleAlert } from '@lucide/svelte';

  import { ApiError, forgotPassword } from '$lib/auth';

  let email = $state('');
  let errorMessage = $state('');
  let successMessage = $state('');
  let resetToken = $state('');
  let isSubmitting = $state(false);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    errorMessage = '';
    successMessage = '';
    resetToken = '';
    isSubmitting = true;

    try {
      const result = await forgotPassword(email.trim());
      successMessage = result.message;
      resetToken = result.reset_token ?? '';
    } catch (error) {
      errorMessage = error instanceof ApiError ? error.message : 'Gagal mengirim instruksi reset password.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Seller Forgot Password | Jeevatix</title>
  <meta
    name="description"
    content="Minta instruksi reset password untuk akun seller Jeevatix melalui email terdaftar."
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
        <p class="text-sm font-semibold tracking-[0.32em] text-emerald-700/70 uppercase">Password Recovery</p>
        <h1 class="text-3xl font-semibold tracking-tight text-slate-950">Reset akses Seller Studio</h1>
        <p class="text-sm leading-6 text-slate-600">
          Masukkan email akun seller Anda. Kami akan kirim instruksi reset password agar akses operasional bisa dipulihkan.
        </p>
      </div>
      <div class="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <Mail class="size-7" />
      </div>
    </div>

    <form class="mt-8 space-y-5" onsubmit={handleSubmit}>
      <div class="space-y-2">
        <label class="text-sm font-medium text-slate-700" for="email">Email Seller</label>
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

      {#if errorMessage}
        <div class="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <TriangleAlert class="mt-0.5 size-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      {/if}

      {#if successMessage}
        <div class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p>{successMessage}</p>
          {#if resetToken}
            <p class="mt-2 break-all font-medium">Dev reset token: {resetToken}</p>
          {/if}
        </div>
      {/if}

      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a class="text-sm font-medium text-emerald-700 hover:text-emerald-800" href={resolve('/login')}>
          Kembali ke login
        </a>
        <Button type="submit" disabled={isSubmitting}>
          {#if isSubmitting}
            Mengirim...
          {:else}
            Kirim Instruksi
          {/if}
        </Button>
      </div>
    </form>
  </Card>
</section>