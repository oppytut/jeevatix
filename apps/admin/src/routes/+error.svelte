<script lang="ts">
  import { page } from '$app/stores';
  import { resolve } from '$app/paths';

  const errorMessages: Record<number, string> = {
    404: 'Halaman tidak ditemukan',
    500: 'Terjadi kesalahan server',
    503: 'Layanan tidak tersedia',
  };

  const status = $derived($page.status);
  const message = $derived(errorMessages[status] || 'Terjadi kesalahan');
</script>

<div class="flex min-h-[70vh] items-center justify-center px-6">
  <div class="w-full max-w-md space-y-8 text-center">
    <div class="space-y-4">
      <div class="mx-auto flex size-24 items-center justify-center rounded-full bg-foreground/5">
        <span class="text-5xl font-black text-foreground">{status}</span>
      </div>

      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight text-foreground">{message}</h1>
        <p class="text-sm text-muted-foreground">
          {#if status === 404}
            Halaman yang Anda cari tidak ada atau telah dipindahkan.
          {:else if status === 500}
            Mohon maaf, terjadi kesalahan pada server kami.
          {:else}
            Silakan coba lagi nanti atau hubungi dukungan jika masalah berlanjut.
          {/if}
        </p>
      </div>
    </div>

    <a
      href={resolve('/')}
      class="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-foreground/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      Kembali ke Dashboard
    </a>
  </div>
</div>
