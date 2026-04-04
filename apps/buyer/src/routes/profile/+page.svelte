<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Camera, KeyRound, Mail, Phone, Save, ShieldCheck, UserRound } from '@lucide/svelte';

  import { Button, Card, Input } from '@jeevatix/ui';

  let { data, form }: import('./$types').PageProps = $props();

  let selectedAvatarPreview = $state<string | null>(null);
  let selectedFileName = $state('');
  let objectUrl: string | null = null;

  function getProfile() {
    return form?.profile ?? data.profile;
  }

  function getAvatarSrc() {
    return selectedAvatarPreview ?? getProfile().avatar_url;
  }

  function handleAvatarChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }

      selectedAvatarPreview = null;
      selectedFileName = '';
      return;
    }

    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }

    objectUrl = URL.createObjectURL(file);
    selectedAvatarPreview = objectUrl;
    selectedFileName = file.name;
  }

  onDestroy(() => {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  });
</script>

<svelte:head>
  <title>Profil Buyer | Jeevatix</title>
  <meta
    name="description"
    content="Kelola profil buyer Jeevatix, avatar akun, dan password untuk pengalaman checkout yang lebih lancar."
  />
</svelte:head>

<section class="space-y-8 py-6 sm:py-8 lg:py-10">
  <div
    class="rounded-[2.5rem] border border-white/80 bg-[linear-gradient(135deg,#fff8ef_0%,#fff2df_42%,#edf8ff_100%)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-sm font-semibold tracking-[0.3em] text-slate-500 uppercase">Buyer Profile</p>
        <h1 class="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Rapikan profil untuk checkout yang lebih cepat.
        </h1>
        <p class="max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
          Perbarui identitas dasar akun Anda, simpan avatar yang mudah dikenali, dan pastikan
          password tetap aman.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-[1.5rem] border border-white/70 bg-white/75 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Email</p>
          <p class="mt-2 text-sm font-medium text-slate-900">{getProfile().email}</p>
        </div>
        <div class="rounded-[1.5rem] border border-white/70 bg-white/75 px-5 py-4 backdrop-blur">
          <p class="text-xs font-semibold tracking-[0.24em] text-slate-500 uppercase">Status</p>
          <p class="mt-2 inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            <ShieldCheck class="size-4" />
            {getProfile().status}
          </p>
        </div>
      </div>
    </div>
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
    <Card
      class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Profil</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Identitas akun buyer
          </h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Data ini dipakai untuk pengenal akun dan komunikasi seputar transaksi Anda.
          </p>
        </div>

        <div
          class="flex size-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-700"
        >
          <UserRound class="size-7" />
        </div>
      </div>

      <form
        class="mt-8 space-y-6"
        method="POST"
        action="?/updateProfile"
        enctype="multipart/form-data"
      >
        <div
          class="flex flex-col gap-5 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 sm:flex-row sm:items-center"
        >
          <div
            class="flex size-24 items-center justify-center overflow-hidden rounded-[1.5rem] bg-[linear-gradient(135deg,#f97316,#facc15)] text-2xl font-semibold text-slate-950"
          >
            {#if getAvatarSrc()}
              <img
                src={getAvatarSrc() ?? undefined}
                alt={getProfile().full_name}
                class="h-full w-full object-cover"
              />
            {:else}
              {getProfile().full_name.slice(0, 1)}
            {/if}
          </div>

          <div class="min-w-0 flex-1 space-y-3">
            <div>
              <p class="text-sm font-medium text-slate-900">Avatar akun</p>
              <p class="mt-1 text-sm text-slate-600">
                Unggah JPG, PNG, atau WebP untuk memudahkan identifikasi akun buyer.
              </p>
            </div>

            <label
              class="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
              for="avatar"
            >
              <Camera class="size-4" />
              Pilih Avatar
            </label>
            <input
              id="avatar"
              name="avatar"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              onchange={handleAvatarChange}
            />

            {#if selectedFileName}
              <p class="truncate text-sm text-slate-500">File dipilih: {selectedFileName}</p>
            {/if}
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <label class="text-sm font-medium text-slate-700" for="full_name">Full Name</label>
            <Input
              id="full_name"
              name="full_name"
              value={getProfile().full_name}
              placeholder="Nama lengkap buyer"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700" for="email">Email</label>
            <div class="relative">
              <Mail
                class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              />
              <Input id="email" value={getProfile().email} class="pl-10" readonly disabled />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700" for="phone">Phone</label>
            <div class="relative">
              <Phone
                class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
              />
              <Input
                id="phone"
                name="phone"
                value={getProfile().phone ?? ''}
                class="pl-10"
                placeholder="08xxxxxxxxxx"
              />
            </div>
          </div>
        </div>

        {#if form?.profileError}
          <div
            class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {form.profileError}
          </div>
        {/if}

        {#if form?.profileSuccess}
          <div
            class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            {form.profileSuccess}
          </div>
        {/if}

        <Button type="submit" class="rounded-full px-6">
          Simpan Profil
          <Save class="size-4" />
        </Button>
      </form>
    </Card>

    <Card
      class="rounded-[2rem] border border-white/80 bg-white/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold tracking-[0.26em] text-slate-500 uppercase">Security</p>
          <h2 class="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Ubah password</h2>
          <p class="mt-2 text-sm leading-6 text-slate-600">
            Gunakan kombinasi password baru yang kuat untuk menjaga keamanan akun buyer Anda.
          </p>
        </div>

        <div class="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <KeyRound class="size-7" />
        </div>
      </div>

      <form class="mt-8 space-y-5" method="POST" action="?/changePassword">
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700" for="old_password">Old Password</label>
          <Input
            id="old_password"
            name="old_password"
            type="password"
            autocomplete="current-password"
            placeholder="Masukkan password saat ini"
            required
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700" for="new_password">New Password</label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            autocomplete="new-password"
            placeholder="Minimal 8 karakter"
            required
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-700" for="confirm_password"
            >Confirm New Password</label
          >
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autocomplete="new-password"
            placeholder="Ulangi password baru"
            required
          />
        </div>

        {#if form?.passwordError}
          <div
            class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {form.passwordError}
          </div>
        {/if}

        {#if form?.passwordSuccess}
          <div
            class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          >
            {form.passwordSuccess}
          </div>
        {/if}

        <Button type="submit" class="rounded-full px-6">
          Perbarui Password
          <KeyRound class="size-4" />
        </Button>
      </form>
    </Card>
  </div>
</section>
