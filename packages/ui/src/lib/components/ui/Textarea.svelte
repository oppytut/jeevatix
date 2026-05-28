<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  import { cn } from '../../utils';

  type Props = HTMLTextareaAttributes & {
    class?: string;
    value?: string;
  };

  let { class: className = '', value = $bindable(), ...restProps }: Props = $props();
</script>

<textarea
  bind:value
  class={cn(
    'w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 focus:outline-none',
    className,
  )}
  {...restProps}
></textarea>
