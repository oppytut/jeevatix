<script lang="ts">
  import { resolve } from '$app/paths';
  import { ShieldCheck, KeyRound, LoaderCircle } from '@lucide/svelte';
  import { Button, Card, Input, Toast } from '@jeevatix/ui';

  import { ApiError, apiPatch } from '$lib/api';

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  type PasswordForm = {
    old_password: string;
    new_password: string;
    confirm_new_password: string;
  };

  let isSubmitting = $state(false);
  let formError = $state('');
  let toast = $state<ToastState | null>(null);
  let form = $state<PasswordForm>({
    old_password: '',
    new_password: '',
    confirm_new_password: '',
  });

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3600);
  }

  function resetForm() {
    form = {
      old_password: '',
      new_password: '',
      confirm_new_password: '',
    };
  }

  async function handleSubmit() {
    if (!form.old_password || !form.new_password || !form.confirm_new_password) {
      formError = 'Semua field password wajib diisi.';
      return;
    }

    if (form.new_password.length < 8) {
      formError = 'Password baru minimal 8 karakter.';
      return;
    }

    if (form.new_password !== form.confirm_new_password) {
      formError = 'Konfirmasi password baru tidak cocok.';
      return;
    }

    formError = '';
    isSubmitting = true;

    try {
      await apiPatch<{ message: string }>('/users/me/password', {
        old_password: form.old_password,
        new_password: form.new_password,
      });

      resetForm();
      setToast({
        title: 'Password diperbarui',
        description: 'Password akun seller berhasil diubah.',
        variant: 'success',
      });
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal mengubah password akun seller.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<section class="space-y-8">
  <div class="space-y-3">
    <p class="text-sm font-semibold tracking-[0.35em] text-emerald-700/70 uppercase">
      Security
    </p>
    <div class="space-y-2">
      <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
        Ubah Password
      </h1>
      <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
        Amankan akun seller dengan password baru yang kuat dan berbeda dari password sebelumnya.
      </p>
    </div>
  </div>

  {#if toast}
    <Toast title={toast.title} description={toast.description} variant={toast.variant} actionLabel={undefined} />
  {/if}

  {#if formError}
    <Toast title="Perlu perhatian" description={formError} variant="warning" actionLabel={undefined} />
  {/if}

  <div class="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
    <Card
      title="Perbarui kredensial akun"
      description="Gunakan kombinasi password yang kuat agar akses dashboard seller tetap aman."
      class="rounded-[2rem] border-emerald-900/10 bg-white/90 shadow-[0_30px_80px_rgba(6,78,59,0.08)]"
    >
      <form class="space-y-6" onsubmit={(event) => event.preventDefault()}>
        <label class="block space-y-2" for="old-password">
          <span class="text-sm font-medium text-slate-700">Old Password</span>
          <Input id="old-password" bind:value={form.old_password} type="password" placeholder="Masukkan password saat ini" autocomplete="current-password" />
        </label>

        <label class="block space-y-2" for="new-password">
          <span class="text-sm font-medium text-slate-700">New Password</span>
          <Input id="new-password" bind:value={form.new_password} type="password" placeholder="Minimal 8 karakter" autocomplete="new-password" />
        </label>

        <label class="block space-y-2" for="confirm-new-password">
          <span class="text-sm font-medium text-slate-700">Confirm New Password</span>
          <Input id="confirm-new-password" bind:value={form.confirm_new_password} type="password" placeholder="Ulangi password baru" autocomplete="new-password" />
        </label>

        <div class="flex flex-wrap items-center gap-3">
          <Button onclick={handleSubmit} disabled={isSubmitting}>
            {#if isSubmitting}
              <LoaderCircle class="mr-2 size-4 animate-spin" />
            {/if}
            Simpan Password
          </Button>

          <a
            href={resolve('/profile')}
            class="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:border-jeevatix-300 hover:bg-jeevatix-50"
          >
            Kembali ke Profil
          </a>
        </div>
      </form>
    </Card>

    <div class="space-y-6">
      <Card
        title="Checklist keamanan"
        description="Pedoman singkat agar kredensial seller tetap aman dari reuse atau kebocoran."
        class="rounded-[2rem] bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,1))]"
      >
        <div class="space-y-4 text-sm leading-6 text-slate-600">
          <div class="flex items-start gap-3 rounded-[1.4rem] border border-emerald-200 bg-white/80 px-4 py-4">
            <ShieldCheck class="mt-0.5 size-4 text-emerald-700" />
            <p>Gunakan kombinasi huruf besar, huruf kecil, angka, dan simbol jika memungkinkan.</p>
          </div>

          <div class="flex items-start gap-3 rounded-[1.4rem] border border-slate-200 bg-white/80 px-4 py-4">
            <KeyRound class="mt-0.5 size-4 text-slate-700" />
            <p>Hindari memakai password yang sama dengan email, marketplace, atau dashboard lain.</p>
          </div>
        </div>
      </Card>
    </div>
  </div>
</section>