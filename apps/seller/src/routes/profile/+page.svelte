<script lang="ts">
  import { resolve } from '$app/paths';
  import { onMount } from 'svelte';
  import { Building2, CheckCircle2, Clock3, Landmark, LoaderCircle, Upload } from '@lucide/svelte';
  import { Button, Card, Input, Toast } from '@jeevatix/ui';

  import { ApiError, apiGet, apiPatch, apiPost } from '$lib/api';

  type SellerProfile = {
    id: string;
    user_id: string;
    email: string;
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    org_name: string;
    org_description: string | null;
    logo_url: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_account_holder: string | null;
    is_verified: boolean;
    verified_at: string | null;
    created_at: string;
    updated_at: string;
  };

  type SellerProfileForm = {
    org_name: string;
    org_description: string;
    logo_url: string;
    bank_name: string;
    bank_account_number: string;
    bank_account_holder: string;
  };

  type ToastState = {
    title: string;
    description: string;
    variant: 'default' | 'success' | 'warning';
  };

  let isLoading = $state(true);
  let isSaving = $state(false);
  let isUploading = $state(false);
  let pageError = $state('');
  let formError = $state('');
  let profile = $state<SellerProfile | null>(null);
  let toast = $state<ToastState | null>(null);
  let form = $state<SellerProfileForm>({
    org_name: '',
    org_description: '',
    logo_url: '',
    bank_name: '',
    bank_account_number: '',
    bank_account_holder: '',
  });

  function setToast(nextToast: ToastState) {
    toast = nextToast;

    const timeout = window.setTimeout(() => {
      toast = null;
      window.clearTimeout(timeout);
    }, 3600);
  }

  function syncForm(nextProfile: SellerProfile) {
    form = {
      org_name: nextProfile.org_name,
      org_description: nextProfile.org_description ?? '',
      logo_url: nextProfile.logo_url ?? '',
      bank_name: nextProfile.bank_name ?? '',
      bank_account_number: nextProfile.bank_account_number ?? '',
      bank_account_holder: nextProfile.bank_account_holder ?? '',
    };
  }

  async function loadProfile() {
    isLoading = true;
    pageError = '';

    try {
      const response = await apiGet<SellerProfile>('/seller/profile');
      profile = response;
      syncForm(response);
    } catch (error) {
      pageError = error instanceof ApiError ? error.message : 'Gagal memuat profil seller.';
    } finally {
      isLoading = false;
    }
  }

  async function uploadLogo(file: File) {
    const body = new FormData();
    body.append('file', file);

    return apiPost<{ url: string }>('/upload', body);
  }

  async function handleLogoUpload(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    formError = '';
    isUploading = true;

    try {
      const uploaded = await uploadLogo(file);
      form.logo_url = uploaded.url;
      setToast({
        title: 'Logo terunggah',
        description: 'Logo organisasi berhasil diperbarui untuk profil seller.',
        variant: 'success',
      });
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal mengunggah logo organisasi.';
    } finally {
      isUploading = false;
      input.value = '';
    }
  }

  async function handleSubmit() {
    if (!form.org_name.trim()) {
      formError = 'Nama organisasi wajib diisi.';
      return;
    }

    formError = '';
    isSaving = true;

    try {
      const updatedProfile = await apiPatch<SellerProfile>('/seller/profile', {
        org_name: form.org_name.trim(),
        org_description: form.org_description.trim() || undefined,
        logo_url: form.logo_url.trim() || undefined,
        bank_name: form.bank_name.trim() || undefined,
        bank_account_number: form.bank_account_number.trim() || undefined,
        bank_account_holder: form.bank_account_holder.trim() || undefined,
      });

      profile = updatedProfile;
      syncForm(updatedProfile);
      setToast({
        title: 'Profil diperbarui',
        description: 'Perubahan profil organisasi sudah tersimpan.',
        variant: 'success',
      });
    } catch (error) {
      formError = error instanceof ApiError ? error.message : 'Gagal menyimpan profil organisasi.';
    } finally {
      isSaving = false;
    }
  }

  function formatDate(value: string | null) {
    if (!value) {
      return 'Belum diverifikasi';
    }

    return new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  onMount(() => {
    void loadProfile();
  });
</script>

<section class="space-y-8">
  <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div class="space-y-3">
      <p class="text-sm font-semibold tracking-[0.35em] text-emerald-700/70 uppercase">
        Seller Profile
      </p>
      <div class="space-y-2">
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Profil Organisasi
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Kelola identitas brand seller, aset logo, dan rekening pencairan untuk operasional event.
        </p>
      </div>
    </div>

    <a
      href={resolve('/profile/password')}
      class="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-jeevatix-300 hover:bg-jeevatix-50"
    >
      Ubah Password
    </a>
  </div>

  {#if toast}
    <Toast title={toast.title} description={toast.description} variant={toast.variant} actionLabel={undefined} />
  {/if}

  {#if pageError}
    <Toast title="Gagal memuat profil" description={pageError} variant="warning" actionLabel={undefined} />
  {/if}

  {#if formError}
    <Toast title="Perlu perhatian" description={formError} variant="warning" actionLabel={undefined} />
  {/if}

  <div class="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
    <Card
      title="Informasi Organisasi"
      description="Pastikan nama brand, deskripsi, dan rekening pencairan selalu akurat untuk proses verifikasi dan settlement."
      class="rounded-[2rem] border-emerald-900/10 bg-white/90 shadow-[0_30px_80px_rgba(6,78,59,0.08)]"
    >
      {#if isLoading}
        <div class="flex min-h-80 items-center justify-center text-slate-500">
          <LoaderCircle class="size-5 animate-spin" />
          <span class="ml-3 text-sm">Memuat profil seller...</span>
        </div>
      {:else}
        <form class="space-y-8" onsubmit={(event) => event.preventDefault()}>
          <div class="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div class="space-y-4">
              <div class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-slate-50">
                {#if form.logo_url}
                  <img src={form.logo_url} alt="Logo organisasi seller" class="h-52 w-full object-cover" />
                {:else}
                  <div class="flex h-52 items-center justify-center bg-[radial-gradient(circle_at_top,#ecfdf5_0%,#f8fafc_65%,#ffffff_100%)] text-slate-500">
                    <Building2 class="size-10" />
                  </div>
                {/if}
              </div>

              <label class="block space-y-2" for="seller-logo">
                <span class="text-sm font-medium text-slate-700">Logo organisasi</span>
                <input
                  id="seller-logo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  class="hidden"
                  onchange={handleLogoUpload}
                />
                <span class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-jeevatix-300 hover:bg-jeevatix-50">
                  {#if isUploading}
                    <LoaderCircle class="size-4 animate-spin" />
                    Mengunggah...
                  {:else}
                    <Upload class="size-4" />
                    Upload Logo
                  {/if}
                </span>
              </label>
            </div>

            <div class="space-y-6">
              <div class="grid gap-5 sm:grid-cols-2">
                <label class="block space-y-2 sm:col-span-2" for="org-name">
                  <span class="text-sm font-medium text-slate-700">Org Name</span>
                  <Input id="org-name" bind:value={form.org_name} placeholder="Nama organisasi seller" maxlength={200} />
                </label>

                <label class="block space-y-2 sm:col-span-2" for="org-description">
                  <span class="text-sm font-medium text-slate-700">Org Description</span>
                  <textarea
                    id="org-description"
                    bind:value={form.org_description}
                    rows="6"
                    class="focus:border-jeevatix-300 focus:ring-jeevatix-200 w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:ring-2 focus:outline-none"
                    placeholder="Jelaskan positioning brand, jenis event, dan karakter audiens organisasi Anda."
                  ></textarea>
                </label>

                <label class="block space-y-2" for="bank-name">
                  <span class="text-sm font-medium text-slate-700">Bank Name</span>
                  <Input id="bank-name" bind:value={form.bank_name} placeholder="Contoh: Bank Central Asia" maxlength={100} />
                </label>

                <label class="block space-y-2" for="bank-account-number">
                  <span class="text-sm font-medium text-slate-700">Account Number</span>
                  <Input id="bank-account-number" bind:value={form.bank_account_number} placeholder="Nomor rekening pencairan" maxlength={50} inputmode="numeric" />
                </label>

                <label class="block space-y-2 sm:col-span-2" for="bank-account-holder">
                  <span class="text-sm font-medium text-slate-700">Account Holder</span>
                  <Input id="bank-account-holder" bind:value={form.bank_account_holder} placeholder="Nama pemilik rekening" maxlength={150} />
                </label>
              </div>

              <div class="flex flex-wrap items-center gap-3">
                <Button onclick={handleSubmit} disabled={isSaving || isLoading || isUploading}>
                  {#if isSaving}
                    <LoaderCircle class="mr-2 size-4 animate-spin" />
                  {/if}
                  Simpan Profil
                </Button>

                <span class="text-sm text-slate-500">Update terakhir: {formatDate(profile?.updated_at ?? null)}</span>
              </div>
            </div>
          </div>
        </form>
      {/if}
    </Card>

    <div class="space-y-6">
      <Card
        title="Status Verifikasi"
        description="Status ini menentukan kesiapan akun seller untuk mengelola event yang dipublikasikan."
        class="rounded-[2rem] border-emerald-900/10 bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,1))]"
      >
        {#if profile}
          <div class="space-y-5">
            <div class={`rounded-[1.6rem] border px-5 py-4 ${profile.is_verified ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <div class="flex items-center gap-3">
                {#if profile.is_verified}
                  <CheckCircle2 class="size-5" />
                  <div>
                    <p class="text-sm font-semibold">Verified</p>
                    <p class="text-sm opacity-80">Diverifikasi pada {formatDate(profile.verified_at)}</p>
                  </div>
                {:else}
                  <Clock3 class="size-5" />
                  <div>
                    <p class="text-sm font-semibold">Pending</p>
                    <p class="text-sm opacity-80">Lengkapi profil agar proses review seller lebih cepat.</p>
                  </div>
                {/if}
              </div>
            </div>

            <div class="space-y-4 rounded-[1.6rem] border border-white/70 bg-white/90 p-5 shadow-sm">
              <div>
                <p class="text-xs font-semibold tracking-[0.3em] text-slate-500 uppercase">Owner Account</p>
                <p class="mt-2 text-lg font-semibold text-slate-950">{profile.full_name}</p>
                <p class="text-sm text-slate-600">{profile.email}</p>
              </div>

              <div class="grid gap-4 text-sm text-slate-600">
                <div>
                  <p class="font-medium text-slate-900">Kontak</p>
                  <p>{profile.phone ?? 'Belum ada nomor telepon'}</p>
                </div>

                <div>
                  <p class="font-medium text-slate-900">Logo URL</p>
                  <p class="break-all">{form.logo_url || 'Belum ada logo organisasi'}</p>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </Card>

      <Card
        title="Data Pencairan"
        description="Gunakan rekening aktif untuk settlement penjualan tiket dan proses refund manual jika diperlukan."
        class="rounded-[2rem]"
      >
        <div class="space-y-4 text-sm text-slate-600">
          <div class="flex items-start gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4">
            <Landmark class="mt-0.5 size-4 text-slate-500" />
            <div>
              <p class="font-medium text-slate-900">Pastikan detail rekening valid</p>
              <p class="mt-1 leading-6">
                Kesalahan nama pemilik atau nomor rekening akan memperlambat pencairan dana dari event yang sudah selesai.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</section>