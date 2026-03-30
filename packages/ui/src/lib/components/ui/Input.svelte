<script lang="ts">
	import { cn } from '../../utils';

	let className = '';
	export { className as class };
</script>

<input
	class={cn(
		'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-jeevatix-300 focus:outline-none focus:ring-2 focus:ring-jeevatix-200',
		className
	)}
	{...$$restProps}
/>