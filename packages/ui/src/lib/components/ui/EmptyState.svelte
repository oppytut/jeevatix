<script lang="ts">
  import { cn } from '../../utils';

  type Props = {
    class?: string;
    title?: string;
    description?: string;
    icon?: import('svelte').Snippet;
    action?: import('svelte').Snippet;
  };

  let {
    class: className = '',
    title = 'Tidak ada data',
    description = '',
    icon,
    action,
  }: Props = $props();
</script>

<div class={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
  {#if icon}
    <div
      class="bg-muted text-muted-foreground mb-4 flex size-16 items-center justify-center rounded-full"
    >
      {@render icon()}
    </div>
  {/if}
  <h3 class="text-foreground text-lg font-semibold">{title}</h3>
  {#if description}
    <p class="text-muted-foreground mt-1 max-w-sm text-sm">{description}</p>
  {/if}
  {#if action}
    <div class="mt-4">
      {@render action()}
    </div>
  {/if}
</div>
