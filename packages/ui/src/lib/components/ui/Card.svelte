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
  class={cn('rounded-(--radius-card) border border-slate-200/80 bg-white p-6 shadow-sm', className)}
>
  {#if title || description}
    <header class="space-y-2">
      {#if title}
        <h3 class="text-lg font-semibold tracking-tight text-slate-950">{title}</h3>
      {/if}
      {#if description}
        <p class="text-sm leading-6 text-slate-600">{description}</p>
      {/if}
    </header>
  {/if}

  {#if children}
    <div class={cn(title || description ? 'mt-5' : '')}>
      {@render children()}
    </div>
  {/if}

  {#if footer}
    <footer class="mt-5 border-t border-slate-100 pt-4">
      {@render footer()}
    </footer>
  {/if}
</section>
