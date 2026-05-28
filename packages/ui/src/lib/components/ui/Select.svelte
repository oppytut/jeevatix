<script lang="ts">
  import type { HTMLSelectAttributes } from 'svelte/elements';

  import { cn } from '../../utils';

  type Props = HTMLSelectAttributes & {
    class?: string;
    value?: string;
  };

  let { class: className = '', value = $bindable(), children, ...restProps }: Props = $props();
</script>

<select
  bind:value
  class={cn(
    'w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm transition focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</select>
