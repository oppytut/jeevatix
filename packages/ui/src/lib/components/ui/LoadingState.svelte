<script lang="ts">
  import { cn } from '../../utils';
  import Skeleton from './Skeleton.svelte';

  type Props = {
    class?: string;
    rows?: number;
  };

  let { class: className = '', rows = 3 }: Props = $props();
</script>

<div class={cn('space-y-4', className)}>
  {#each Array(rows) as _}
    <div class="space-y-2">
      <Skeleton class="h-4 w-3/4" />
      <Skeleton class="h-4 w-1/2" />
    </div>
  {/each}
</div>
