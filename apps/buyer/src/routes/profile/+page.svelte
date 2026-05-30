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
    class="rounded-[2.5rem] border border-white/80 bg-[var(--gradient-section-alt)] p-7 shadow-[0_26px_90px_rgba(15,23,42,0.08)] sm:p-9"
  >
    <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="space-y-3">
        <p class="text-muted-foreground text-sm font-semibold tracking-[0.3em] uppercase">
          Buyer Profile
        </p>
        <h1 class="text-foreground text-4xl font-semibold tracking-tight sm:text-5xl">
          Rapikan profil untuk checkout yang lebih cepat.
        </h1>
        <p class="text-muted-foreground max-w-3xl text-base leading-7 sm:text-lg">
          Perbarui identitas dasar akun Anda, simpan avatar yang mudah dikenali, dan pastikan
          password tetap aman.
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="bg-card/75 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Email
          </p>
          <p class="text-foreground mt-2 text-sm font-medium">{getProfile().email}</p>
        </div>
        <div class="bg-card/75 rounded-[1.5rem] border border-white/70 px-5 py-4 backdrop-blur">
          <p class="text-muted-foreground text-xs font-semibold tracking-[0.24em] uppercase">
            Status
          </p>
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
      class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
            Profil
          </p>
          <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">
            Identitas akun buyer
          </h2>
          <p class="text-muted-foreground mt-2 text-sm leading-6">
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
          class="border-border bg-muted flex flex-col gap-5 rounded-[1.75rem] border p-5 sm:flex-row sm:items-center"
        >
          <div
            class="text-foreground flex size-24 items-center justify-center overflow-hidden rounded-[1.5rem] bg-[var(--gradient-brand)] text-2xl font-semibold"
          >
            {#if getAvatarSrc()}
              <img
                src={getAvatarSrc() ?? undefined}
                alt={getProfile().full_name}
                width="96"
                height="96"
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover"
              />
            {:else}
              {getProfile().full_name.slice(0, 1)}
            {/if}
          </div>

          <div class="min-w-0 flex-1 space-y-3">
            <div>
              <p class="text-foreground text-sm font-medium">Avatar akun</p>
              <p class="text-muted-foreground mt-1 text-sm">
                Unggah JPG, PNG, atau WebP untuk memudahkan identifikasi akun buyer.
              </p>
            </div>

            <label
              class="border-border bg-card text-foreground hover:border-border hover:text-foreground inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition"
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
              <p class="text-muted-foreground truncate text-sm">File dipilih: {selectedFileName}</p>
            {/if}
          </div>
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div class="space-y-2 sm:col-span-2">
            <label class="text-foreground text-sm font-medium" for="full_name">Nama Lengkap</label>
            <Input
              id="full_name"
              name="full_name"
              value={getProfile().full_name}
              placeholder="Nama lengkap buyer"
              required
            />
          </div>

          <div class="space-y-2">
            <label class="text-foreground text-sm font-medium" for="email">Email</label>
            <div class="relative">
              <Mail
                class="text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              />
              <Input id="email" value={getProfile().email} class="pl-10" readonly disabled />
            </div>
          </div>

          <div class="space-y-2">
            <label class="text-foreground text-sm font-medium" for="phone">Telepon</label>
            <div class="relative">
              <Phone
                class="text-muted-foreground/70 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
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
      class="bg-card/92 rounded-[2rem] border border-white/80 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-7"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <p class="text-muted-foreground text-sm font-semibold tracking-[0.26em] uppercase">
            Security
          </p>
          <h2 class="text-foreground mt-2 text-3xl font-semibold tracking-tight">Ubah password</h2>
          <p class="text-muted-foreground mt-2 text-sm leading-6">
            Gunakan kombinasi password baru yang kuat untuk menjaga keamanan akun buyer Anda.
          </p>
        </div>

        <div class="flex size-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
          <KeyRound class="size-7" />
        </div>
      </div>

      <form class="mt-8 space-y-5" method="POST" action="?/changePassword">
        <div class="space-y-2">
          <label class="text-foreground text-sm font-medium" for="old_password">Password Lama</label
          >
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
          <label class="text-foreground text-sm font-medium" for="new_password">Password Baru</label
          >
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
          <label class="text-foreground text-sm font-medium" for="confirm_password"
            >Konfirmasi Password Baru</label
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
