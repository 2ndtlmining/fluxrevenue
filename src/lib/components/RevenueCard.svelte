<script>
  export let title = '';
  export let value = 0;
  export let subtitle = '';
  export let trend = null;
  export let color = 'blue';
  export let isInteger = false; // New prop for integer display
</script>

<div class="revenue-card {color}">
  <div class="card-header">
    <h3>{title}</h3>
    {#if trend !== null}
      <span class="trend" class:positive={trend > 0} class:negative={trend < 0}>
        {trend > 0 ? '+' : ''}{trend.toFixed(2)}%
      </span>
    {/if}
  </div>
  
  <div class="value">
    {#if isInteger}
      {typeof value === 'number' ? value.toLocaleString() : value}
    {:else}
      {typeof value === 'number' ? value.toFixed(8) : value}
      <span class="unit">FLUX</span>
    {/if}
  </div>
  
  {#if subtitle}
    <div class="subtitle">{subtitle}</div>
  {/if}
</div>

<style>
  .revenue-card {
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    transition: transform 0.2s ease;
  }

  .revenue-card:hover {
    transform: translateY(-2px);
  }

  .revenue-card.blue {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(99, 102, 241, 0.15));
  }

  .revenue-card.purple {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(168, 85, 247, 0.15));
  }

  .revenue-card.green {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(59, 130, 246, 0.15));
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  h3 {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0;
  }

  .trend {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    backdrop-filter: blur(10px);
  }

  .trend.positive {
    color: #10b981;
    background: rgba(16, 185, 129, 0.1);
  }

  .trend.negative {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .value {
    color: white;
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 0.5rem;
  }

  .unit {
    font-size: 1rem;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 400;
  }

  .subtitle {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.875rem;
  }
</style>