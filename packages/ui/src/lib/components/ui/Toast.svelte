<script lang="ts">
	import { cn } from '../../utils';

	type ToastVariant = 'default' | 'success' | 'warning';

	const toastClasses: Record<ToastVariant, string> = {
		default: 'border-slate-200 bg-white text-slate-900',
		success: 'border-sea-200 bg-sea-50 text-sea-900',
		warning: 'border-amber-200 bg-amber-50 text-amber-900'
	};

	let className = '';
	export { className as class };

	export let title: string | undefined;
	export let description: string | undefined;
	export let actionLabel: string | undefined;
	export let action: (() => void) | undefined = undefined;
	export let variant: ToastVariant = 'default';
</script>

<div class={cn('rounded-[var(--radius-card)] border p-4 shadow-sm', toastClasses[variant], className)}>
	<div class="flex items-start justify-between gap-4">
		<div class="space-y-1">
			{#if title}
				<p class="text-sm font-semibold">{title}</p>
			{/if}
			{#if description}
				<p class="text-sm leading-6 opacity-80">{description}</p>
			{/if}
			{#if $$slots.default}
				<div class="text-sm leading-6 opacity-80">
					<slot />
				</div>
			{/if}
		</div>

		{#if actionLabel}
			<button
				type="button"
				class="rounded-full border border-current/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
				on:click={() => action?.()}
			>
				{actionLabel}
			</button>
		{/if}
	</div>
</div>