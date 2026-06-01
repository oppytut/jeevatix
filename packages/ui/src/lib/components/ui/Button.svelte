<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import { cn } from '../../utils';

  type ButtonVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'success' | 'destructive';
  type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

  const baseClass =
    'inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold tracking-tight transition-[transform,box-shadow,background-color,color] duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  const variantClasses: Record<ButtonVariant, string> = {
    default:
      'bg-foreground text-background px-5 py-2.5 shadow-[var(--shadow-edit)] hover:-translate-y-[2px] hover:shadow-[var(--shadow-edit-lifted)] active:translate-y-0 active:shadow-[var(--shadow-edit)]',
    outline:
      'border border-foreground bg-background text-foreground px-5 py-2.5 shadow-[var(--shadow-edit)] hover:-translate-y-[2px] hover:shadow-[var(--shadow-edit-lifted)] active:translate-y-0 active:shadow-[var(--shadow-edit)]',
    secondary:
      'bg-muted text-foreground px-5 py-2.5 shadow-[var(--shadow-edit)] hover:-translate-y-[2px] hover:shadow-[var(--shadow-edit-lifted)] active:translate-y-0 active:shadow-[var(--shadow-edit)]',
    ghost: 'px-4 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground',
    success:
      'bg-emerald-600 text-white px-5 py-2.5 shadow-[var(--shadow-edit)] hover:bg-emerald-700 hover:-translate-y-[2px] hover:shadow-[var(--shadow-edit-lifted)] active:translate-y-0 active:shadow-[var(--shadow-edit)] dark:bg-emerald-500 dark:hover:bg-emerald-600',
    destructive:
      'bg-red-600 text-white px-5 py-2.5 shadow-[var(--shadow-edit)] hover:bg-red-700 hover:-translate-y-[2px] hover:shadow-[var(--shadow-edit-lifted)] active:translate-y-0 active:shadow-[var(--shadow-edit)] dark:bg-red-500 dark:hover:bg-red-600',
  };

  const sizeClasses: Record<ButtonSize, string> = {
    default: '',
    sm: 'px-4 py-2 text-xs',
    lg: 'px-7 py-3.5 text-base',
    icon: 'size-10 rounded-2xl p-0',
  };

  type Props = HTMLButtonAttributes & {
    class?: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
    children?: Snippet;
  };

  let {
    class: className = '',
    variant = 'default',
    size = 'default',
    type = 'button',
    children,
    ...restProps
  }: Props = $props();
</script>

<button
  class={cn(baseClass, variantClasses[variant], sizeClasses[size], className)}
  {type}
  {...restProps}
>
  {@render children?.()}
</button>
