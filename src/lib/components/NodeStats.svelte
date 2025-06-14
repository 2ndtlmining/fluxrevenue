<script>
  export let stats = {
    total: 0,
    cumulus: 0,
    nimbus: 0,
    stratus: 0,
    arcane_nodes: 0,
    arcane_percentage: 0,
    cumulus_percentage: 0,
    nimbus_percentage: 0,
    stratus_percentage: 0,
    last_updated: null
  };

  function formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString();
  }

  function formatPercentage(percentage) {
    if (typeof percentage !== 'number') return '0.0%';
    return `${percentage.toFixed(1)}%`;
  }

  function getLastUpdated() {
    if (!stats.last_updated) return 'Never';
    
    const now = Date.now();
    const diff = now - stats.last_updated;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`;
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    return 'Just now';
  }

  function getTierColor(tier) {
    switch(tier) {
      case 'total': return '#60a5fa';
      case 'cumulus': return '#10b981';
      case 'nimbus': return '#f59e0b';
      case 'stratus': return '#ef4444';
      case 'arcane': return '#8b5cf6';
      default: return '#6b7280';
    }
  }

  // Generate ASCII-style bar for percentages (like htop/btop)
  function generateBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  // Generate colored bar segments for distribution
  function generateDistributionBar(cumulus, nimbus, stratus, width = 40) {
    const cumulusFilled = Math.round((cumulus / 100) * width);
    const nimbusFilled = Math.round((nimbus / 100) * width);
    const stratusFilled = Math.round((stratus / 100) * width);
    
    let bar = '';
    let pos = 0;
    
    // Cumulus segment
    if (cumulusFilled > 0) {
      bar += '█'.repeat(Math.min(cumulusFilled, width - pos));
      pos += cumulusFilled;
    }
    
    // Nimbus segment  
    if (nimbusFilled > 0 && pos < width) {
      bar += '▓'.repeat(Math.min(nimbusFilled, width - pos));
      pos += nimbusFilled;
    }
    
    // Stratus segment
    if (stratusFilled > 0 && pos < width) {
      bar += '▒'.repeat(Math.min(stratusFilled, width - pos));
      pos += stratusFilled;
    }
    
    // Fill remaining with empty
    bar += '░'.repeat(Math.max(0, width - pos));
    
    return bar.substring(0, width);
  }
</script>

<div class="flux-panel">
  <div class="panel-header">
    <span>Network Node Stats</span>
    <span style="font-size: 12px; color: rgba(255,255,255,0.7);">Updated: {getLastUpdated()}</span>
  </div>
  <div class="panel-content">
    <!-- System Status Row -->
    <div class="metrics-row">
      <div class="metric-group">
        <div class="metric">
          <span class="metric-label">Status:</span>
          <span class="metric-value online">●</span>
        </div>
        <div class="metric">
          <span class="metric-label">Total Nodes:</span>
          <span class="metric-value">{formatNumber(stats.total)}</span>
        </div>
      </div>
      <div class="metric-group">
        <div class="metric">
          <span class="metric-label">MainPid:</span>
          <span class="metric-value">2158</span>
        </div>
        <div class="metric">
          <span class="metric-label">Online:</span>
          <span class="metric-value online">●</span>
        </div>
      </div>
    </div>
    
    <!-- Network Distribution Bar (htop-style) -->
    <div class="distribution-section">
      <div class="distribution-header">Network Distribution:</div>
      <div class="distribution-bar-container">
        <div class="distribution-bar">
          <span class="bar-text cumulus">{generateDistributionBar(stats.cumulus_percentage, stats.nimbus_percentage, stats.stratus_percentage)}</span>
        </div>
        <div class="distribution-legend">
          <span class="legend-item cumulus">█ Cumulus {formatPercentage(stats.cumulus_percentage)}</span>
          <span class="legend-item nimbus">▓ Nimbus {formatPercentage(stats.nimbus_percentage)}</span>
          <span class="legend-item stratus">▒ Stratus {formatPercentage(stats.stratus_percentage)}</span>
        </div>
      </div>
    </div>
    
    <!-- Node Type Stats Grid -->
    <div class="node-stats-grid">
      <!-- Cumulus Nodes -->
      <div class="node-stat-item cumulus">
        <div class="node-header">
          <span class="node-type">Cumulus</span>
          <span class="node-count">{formatNumber(stats.cumulus)}</span>
        </div>
        <div class="node-bar-container">
          <div class="ascii-bar cumulus">{generateBar(stats.cumulus_percentage)}</div>
          <span class="node-percentage">{formatPercentage(stats.cumulus_percentage)}</span>
        </div>
        <div class="node-details">
          <span class="collateral">1,000 FLUX</span>
          <span class="tier-label">Entry Tier</span>
        </div>
      </div>

      <!-- Nimbus Nodes -->
      <div class="node-stat-item nimbus">
        <div class="node-header">
          <span class="node-type">Nimbus</span>
          <span class="node-count">{formatNumber(stats.nimbus)}</span>
        </div>
        <div class="node-bar-container">
          <div class="ascii-bar nimbus">{generateBar(stats.nimbus_percentage)}</div>
          <span class="node-percentage">{formatPercentage(stats.nimbus_percentage)}</span>
        </div>
        <div class="node-details">
          <span class="collateral">12,500 FLUX</span>
          <span class="tier-label">Mid Tier</span>
        </div>
      </div>

      <!-- Stratus Nodes -->
      <div class="node-stat-item stratus">
        <div class="node-header">
          <span class="node-type">Stratus</span>
          <span class="node-count">{formatNumber(stats.stratus)}</span>
        </div>
        <div class="node-bar-container">
          <div class="ascii-bar stratus">{generateBar(stats.stratus_percentage)}</div>
          <span class="node-percentage">{formatPercentage(stats.stratus_percentage)}</span>
        </div>
        <div class="node-details">
          <span class="collateral">40,000 FLUX</span>
          <span class="tier-label">High Tier</span>
        </div>
      </div>

      <!-- ArcaneOS Nodes -->
      <div class="node-stat-item arcane">
        <div class="node-header">
          <span class="node-type">ArcaneOS</span>
          <span class="node-count">{formatNumber(stats.arcane_nodes)}</span>
        </div>
        <div class="node-bar-container">
          <div class="ascii-bar arcane">{generateBar(stats.arcane_percentage)}</div>
          <span class="node-percentage">{formatPercentage(stats.arcane_percentage)}</span>
        </div>
        <div class="node-details">
          <span class="collateral">Enhanced OS</span>
          <span class="tier-label">Next-gen</span>
        </div>
      </div>
    </div>

    <!-- ASCII Performance Monitor Section -->
  </div>
</div>

<style>
  /* Use CSS variables from the terminal theme */
  .flux-panel {
    background: var(--flux-panel-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .panel-header {
    background: linear-gradient(135deg, var(--flux-border), var(--flux-blue));
    color: var(--flux-text);
    padding: 12px 20px;
    font-weight: 600;
    font-size: 14px;
    border-bottom: 1px solid var(--flux-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-content {
    padding: 20px;
  }

  /* Metrics Display */
  .metrics-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    font-size: 13px;
  }

  .metric-group {
    display: flex;
    gap: 20px;
  }

  .metric {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .metric-label {
    color: var(--flux-text-dim);
  }

  .metric-value {
    color: var(--flux-text);
    font-weight: 500;
    font-family: 'JetBrains Mono', monospace;
  }

  .metric-value.online {
    color: var(--status-online);
  }

  /* Distribution Section (htop-style) */
  .distribution-section {
    margin-bottom: 20px;
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 15px;
  }

  .distribution-header {
    color: var(--flux-text-dim);
    font-size: 12px;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .distribution-bar-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .distribution-bar {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    line-height: 1;
  }

  .bar-text.cumulus {
    background: linear-gradient(90deg, 
      var(--flux-cyan) 0%, 
      var(--flux-purple) 50%, 
      var(--flux-orange) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .distribution-legend {
    display: flex;
    gap: 15px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
  }

  .legend-item {
    color: var(--flux-text-dim);
  }

  .legend-item.cumulus { color: var(--flux-cyan); }
  .legend-item.nimbus { color: var(--flux-purple); }
  .legend-item.stratus { color: var(--flux-orange); }

  /* Node Stats Grid */
  .node-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
  }

  .node-stat-item {
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 15px;
    transition: all 0.2s ease;
  }

  .node-stat-item:hover {
    border-color: var(--flux-blue);
    box-shadow: 0 0 8px rgba(92, 156, 204, 0.2);
  }

  .node-stat-item.cumulus { border-left: 4px solid var(--flux-cyan); }
  .node-stat-item.nimbus { border-left: 4px solid var(--flux-purple); }
  .node-stat-item.stratus { border-left: 4px solid var(--flux-orange); }
  .node-stat-item.arcane { border-left: 4px solid var(--flux-red); }

  .node-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .node-type {
    color: var(--flux-text);
    font-weight: 600;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .node-count {
    color: var(--flux-text);
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 16px;
  }

  .node-bar-container {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }


  .ascii-bar {
    flex: 1;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    line-height: 1;
    letter-spacing: 1px;
  }

  .ascii-bar.cumulus { color: var(--flux-cyan); }
  .ascii-bar.nimbus { color: var(--flux-purple); }
  .ascii-bar.stratus { color: var(--flux-orange); }
  .ascii-bar.arcane { color: var(--flux-red); }

  .node-percentage {
    color: var(--flux-text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    min-width: 45px;
    text-align: right;
  }

  .node-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .collateral {
    color: var(--flux-green);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
  }

  .tier-label {
    color: var(--flux-text-muted);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }


  /* Responsive Design */
  @media (max-width: 1200px) {
    .node-stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 768px) {
    .metrics-row {
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }
    
    .node-stats-grid {
      grid-template-columns: 1fr;
    }

    .distribution-legend {
      flex-direction: column;
      gap: 5px;
    }

    .panel-content {
      padding: 15px;
    }

    .metric-group {
      flex-direction: column;
      gap: 8px;
    }
  }

  @media (max-width: 480px) {
    .node-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
    }

    .node-bar-container {
      flex-direction: column;
      align-items: stretch;
      gap: 5px;
    }

    .node-percentage {
      text-align: left;
    }
  }
</style>