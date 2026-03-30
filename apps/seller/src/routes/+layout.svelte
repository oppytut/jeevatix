<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	const menuItems = [
		'Dashboard',
		'Events',
		'Orders',
		'Check-in',
		'Notifications',
		'Profile'
	] as const;

	let { children } = $props();
</script>

<svelte:head>
	<title>Jeevatix Seller</title>
	<meta
		name="description"
		content="Dashboard seller Jeevatix untuk mengelola event, pesanan, check-in, dan notifikasi operasional."
	/>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[300px_1fr]">
	<aside class="border-b border-emerald-950/20 bg-[radial-gradient(circle_at_top,#134e4a_0%,#052e2b_55%,#021918_100%)] text-emerald-50 lg:min-h-screen lg:border-r lg:border-b-0">
		<div class="flex h-full flex-col px-6 py-8">
			<div class="space-y-3 border-b border-white/10 pb-6">
				<p class="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200/70">
					Jeevatix
				</p>
				<h1 class="text-2xl font-semibold tracking-tight">Seller Studio</h1>
				<p class="text-sm leading-6 text-emerald-100/70">
					Ruang kerja seller untuk memantau penjualan, check-in, dan performa event secara real-time.
				</p>
			</div>

			<nav class="mt-6 flex-1 space-y-2">
				{#each menuItems as item}
					<a
						href="/"
						class="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-emerald-50/85 transition hover:border-amber-300/30 hover:bg-white/10 hover:text-white"
					>
						<span>{item}</span>
						<span class="text-xs uppercase tracking-[0.3em] text-amber-200/60">Open</span>
					</a>
				{/each}
			</nav>

			<div class="rounded-[1.75rem] border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
				<p class="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70">Seller Ops</p>
				<p class="mt-2 text-sm leading-6 text-emerald-100/75">
					Scaffold portal seller siap untuk katalog event, validasi tiket, dan alur notifikasi operasional.
				</p>
			</div>
		</div>
	</aside>

	<main class="min-w-0 bg-[linear-gradient(180deg,rgba(254,252,232,0.65),rgba(255,255,255,1)_22%,rgba(236,253,245,0.8)_100%)]">
		<div class="mx-auto min-h-screen max-w-7xl px-6 py-8 sm:px-10 lg:px-12">
			{@render children()}
		</div>
	</main>
</div>
