<script lang="ts">
  import type { Snippet } from 'svelte';

  import { cn } from '../../utils';

  type Props = {
    class?: string;
    contentClass?: string;
    open?: boolean;
    title?: string;
    description?: string;
    onClose?: () => void;
    children?: Snippet;
  };

  let {
    class: className = '',
    contentClass = '',
    open = false,
    title,
    description,
    onClose,
    children,
  }: Props = $props();
</script>

{#if open}
  <div
    class={cn(
      'bg-foreground/50 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm',
      className,
    )}
  >
    <div
      class={cn(
        'bg-card w-full max-w-2xl rounded-(--radius-panel) border border-white/20 p-6 shadow-(--shadow-spotlight)',
        contentClass,
      )}
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          {#if title}
            <h3 class="text-foreground text-xl font-semibold tracking-tight">{title}</h3>
          {/if}
          {#if description}
            <p class="text-muted-foreground text-sm leading-6">{description}</p>
          {/if}
        </div>
        <button
          type="button"
          class="hover:border-jeevatix-300 hover:text-jeevatix-700 border-border text-muted-foreground rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.2em] uppercase transition"
          onclick={() => onClose?.()}
        >
          Close
        </button>
      </div>

      {#if children}
        <div class="mt-6">
          {@render children()}
        </div>
      {/if}
    </div>
  </div>
{/if}
