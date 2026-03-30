<script lang="ts">
  import './layout.css';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();
</script>

<svelte:head>
  <title>Jeevatix Buyer</title>
  <meta
    name="description"
    content="Portal pembeli Jeevatix untuk menemukan dan membeli tiket event."
  />
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
  {@render children()}
</div>
