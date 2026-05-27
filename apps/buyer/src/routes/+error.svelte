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
      <div
        class="mx-auto flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 to-amber-500/10"
      >
        <span class="text-5xl font-black text-slate-900">{status}</span>
      </div>

      <div class="space-y-2">
        <h1 class="text-3xl font-bold tracking-tight text-slate-950">{message}</h1>
        <p class="text-sm text-slate-600">
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
      class="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-orange-600 hover:to-amber-600 focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:outline-none"
    >
      Kembali ke Beranda
    </a>
  </div>
</div>
