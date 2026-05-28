<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  import { cn } from '../../utils';

  type Props = HTMLInputAttributes & {
    class?: string;
    value?: HTMLInputAttributes['value'];
  };

  let { class: className = '', value = $bindable(), ...restProps }: Props = $props();
</script>

<input
  bind:value
  class={cn(
    'border-border bg-card text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-ring/20 w-full rounded-2xl border px-4 py-3 text-sm shadow-sm transition focus:ring-2 focus:outline-none',
    className,
  )}
  {...restProps}
/>
