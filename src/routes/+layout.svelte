<main>
  <slot />
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
    min-height: 100vh;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  main {
    min-height: 100vh;
    padding: 2rem;
  }

  :global(*) {
    box-sizing: border-box;
  }
</style>