<script lang="ts">
	import { cn } from '../../utils';

	type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost';
	type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

	const baseClass =
		'inline-flex items-center justify-center rounded-full text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jeevatix-300';

	const variantClasses: Record<ButtonVariant, string> = {
		default: 'bg-jeevatix-600 px-5 py-2.5 text-white shadow-[var(--shadow-float)] hover:bg-jeevatix-700',
		outline:
			'border border-slate-300 bg-white px-5 py-2.5 text-slate-900 hover:border-jeevatix-300 hover:bg-jeevatix-50',
		secondary: 'bg-sea-700 px-5 py-2.5 text-white hover:bg-sea-800',
		ghost: 'px-4 py-2.5 text-slate-700 hover:bg-slate-100'
	};

	const sizeClasses: Record<ButtonSize, string> = {
		default: '',
		sm: 'px-4 py-2 text-xs',
		lg: 'px-6 py-3 text-base',
		icon: 'size-10 rounded-2xl p-0'
	};

	let className = '';
	export { className as class };

	export let variant: ButtonVariant = 'default';
	export let size: ButtonSize = 'default';
	export let type: 'button' | 'submit' | 'reset' = 'button';
</script>

<button class={cn(baseClass, variantClasses[variant], sizeClasses[size], className)} {type} {...$$restProps}>
	<slot />
</button>