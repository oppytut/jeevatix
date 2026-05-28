<script lang="ts">
  let isDark = $state(false);

  $effect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark') {
      isDark = true;
      document.documentElement.classList.add('dark');
    } else if (stored === 'light') {
      isDark = false;
      document.documentElement.classList.remove('dark');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      isDark = prefersDark;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      }
    }
  });

  function toggle() {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }
</script>

<button
  onclick={toggle}
  class="border-border bg-card text-muted-foreground hover:bg-muted flex size-10 items-center justify-center rounded-full border transition"
  aria-label="Toggle dark mode"
>
  {#if isDark}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      ><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path
        d="m4.93 4.93 1.41 1.41"
      /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path
        d="m6.34 17.66-1.41 1.41"
      /><path d="m19.07 4.93-1.41 1.41" /></svg
    >
  {:else}
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg
    >
  {/if}
</button>
