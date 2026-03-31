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
    'focus:border-jeevatix-300 focus:ring-jeevatix-200 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:ring-2 focus:outline-none',
    className,
  )}
  {...restProps}
/>
