<script lang="ts">
  import { cn } from '../../utils';

  type Props = {
    class?: string;
  };

  let { class: className = '' }: Props = $props();
</script>

<div class={cn('bg-muted h-4 w-full animate-pulse rounded-md', className)}></div>
