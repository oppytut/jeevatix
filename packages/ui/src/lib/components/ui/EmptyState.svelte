<script lang="ts">
  import { cn } from '../../utils';

  type Props = {
    class?: string;
    title?: string;
    description?: string;
    icon?: import('svelte').Snippet;
    action?: import('svelte').Snippet;
  };

  let { class: className = '', title = 'Tidak ada data', description = '', icon, action }: Props = $props();
</script>

<div class={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
  {#if icon}
    <div class="mb-4 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {@render icon()}
    </div>
  {/if}
  <h3 class="text-lg font-semibold text-foreground">{title}</h3>
  {#if description}
    <p class="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
  {/if}
  {#if action}
    <div class="mt-4">
      {@render action()}
    </div>
  {/if}
</div>
