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
      'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm',
      className,
    )}
  >
    <div
      class={cn(
        'w-full max-w-2xl rounded-(--radius-panel) border border-white/20 bg-white p-6 shadow-(--shadow-spotlight)',
        contentClass,
      )}
    >
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-2">
          {#if title}
            <h3 class="text-xl font-semibold tracking-tight text-slate-950">{title}</h3>
          {/if}
          {#if description}
            <p class="text-sm leading-6 text-slate-600">{description}</p>
          {/if}
        </div>
        <button
          type="button"
          class="hover:border-jeevatix-300 hover:text-jeevatix-700 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase transition"
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
