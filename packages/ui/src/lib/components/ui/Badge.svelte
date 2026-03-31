<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '../../utils';

  type BadgeVariant = 'default' | 'success' | 'neutral' | 'warning';

  const badgeClasses: Record<BadgeVariant, string> = {
    default: 'bg-jeevatix-100 text-jeevatix-700',
    success: 'bg-sea-100 text-sea-700',
    neutral: 'bg-slate-100 text-slate-600',
    warning: 'bg-amber-100 text-amber-700',
  };

  type Props = {
    class?: string;
    variant?: BadgeVariant;
    children?: Snippet;
  };

  let { class: className = '', variant = 'default', children }: Props = $props();
</script>

<span
  class={cn(
    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.22em] uppercase',
    badgeClasses[variant],
    className,
  )}
>
  {@render children?.()}
</span>
