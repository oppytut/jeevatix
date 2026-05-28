<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '../../utils';

  type Props = {
    class?: string;
    title?: string;
    description?: string;
    children?: Snippet;
    footer?: Snippet;
  };

  let { class: className = '', title, description, children, footer }: Props = $props();
</script>

<section
  class={cn('border-border bg-card rounded-(--radius-card) border p-6 shadow-sm', className)}
>
  {#if title || description}
    <header class="space-y-2">
      {#if title}
        <h3 class="text-foreground text-lg font-semibold tracking-tight">{title}</h3>
      {/if}
      {#if description}
        <p class="text-muted-foreground text-sm leading-6">{description}</p>
      {/if}
    </header>
  {/if}

  {#if children}
    <div class={cn(title || description ? 'mt-5' : '')}>
      {@render children()}
    </div>
  {/if}

  {#if footer}
    <footer class="border-border mt-5 border-t pt-4">
      {@render footer()}
    </footer>
  {/if}
</section>
