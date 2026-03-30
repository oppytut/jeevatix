<script lang="ts">
	import { cn } from '../../utils';

	let className = '';
	export { className as class };

	export let title: string | undefined;
	export let description: string | undefined;
</script>

<section class={cn('rounded-(--radius-card) border border-slate-200/80 bg-white p-6 shadow-sm', className)}>
	{#if title || description}
		<header class="space-y-2">
			{#if title}
				<h3 class="text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
			{/if}
			{#if description}
				<p class="text-sm leading-6 text-slate-600">{description}</p>
			{/if}
		</header>
	{/if}

	{#if $$slots.default}
		<div class={cn(title || description ? 'mt-5' : '')}>
			<slot />
		</div>
	{/if}

	{#if $$slots.footer}
		<footer class="mt-5 border-t border-slate-100 pt-4">
			<slot name="footer" />
		</footer>
	{/if}
</section>