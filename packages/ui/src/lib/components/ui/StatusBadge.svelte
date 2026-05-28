<script lang="ts">
  import { cn } from '../../utils';
  import Badge from './Badge.svelte';

  type Variant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

  type Props = {
    class?: string;
    variant?: Variant;
    label: string;
  };

  const variantClasses: Record<Variant, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
    neutral: 'bg-muted text-muted-foreground border-border',
  };

  let { class: className = '', variant = 'neutral', label }: Props = $props();
</script>

<span
  class={cn(
    'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
    variantClasses[variant],
    className,
  )}
>
  {label}
</span>
