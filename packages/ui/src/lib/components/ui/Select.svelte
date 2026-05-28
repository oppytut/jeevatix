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
    'border-border bg-card text-foreground focus:border-ring focus:ring-ring/20 w-full rounded-2xl border px-4 py-3 text-sm shadow-sm transition focus:ring-2 focus:outline-none',
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</select>
