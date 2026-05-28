<script lang="ts">
  import { cn } from '../../utils';

  type Props = {
    class?: string;
  };

  let { class: className = '' }: Props = $props();
</script>

<div class={cn('h-4 w-full animate-pulse rounded-md bg-slate-200', className)}></div>
