<script>
  export let stats = {
    total: {
      cores: 0,
      ram: 0,
      ssd: 0
    },
    utilized: {
      cores: 0,
      nodes: 0,
      ram: 0,
      ssd: 0,
      cores_percentage: 0,
      nodes_percentage: 0,
      ram_percentage: 0,
      ssd_percentage: 0
    },
    running_apps: {
      total_apps: 0,
      nodes_with_apps: 0,
      watchtower_instances: 0
    },
    total_nodes: 0,
    last_updated: null
  };

  export let loading = false;

  // Reactive statement to ensure running_apps always has default values
  $: safeRunningApps = {
    total_apps: stats?.running_apps?.total_apps || 0,
    nodes_with_apps: stats?.running_apps?.nodes_with_apps || 0,
    watchtower_instances: stats?.running_apps?.watchtower_instances || 0
  };

  // Reactive statement to ensure utilized stats are safe
  $: safeUtilized = {
    cores: stats?.utilized?.cores || 0,
    nodes: stats?.utilized?.nodes || 0,
    ram: stats?.utilized?.ram || 0,
    ssd: stats?.utilized?.ssd || 0,
    cores_percentage: stats?.utilized?.cores_percentage || 0,
    nodes_percentage: stats?.utilized?.nodes_percentage || 0,
    ram_percentage: stats?.utilized?.ram_percentage || 0,
    ssd_percentage: stats?.utilized?.ssd_percentage || 0
  };

  // Reactive statement to ensure total stats are safe
  $: safeTotal = {
    cores: stats?.total?.cores || 0,
    ram: stats?.total?.ram || 0,
    ssd: stats?.total?.ssd || 0
  };

  // Safe access to total_nodes
  $: safeTotalNodes = stats?.total_nodes || 0;

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0.00 TB';
    return `${bytes.toFixed(decimals)} TB`;
  }

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

  function getUtilizationColor(percentage) {
    if (percentage >= 80) return 'var(--flux-red)'; 
    if (percentage >= 60) return 'var(--flux-orange)'; 
    if (percentage >= 40) return 'var(--flux-purple)'; 
    return 'var(--flux-cyan)';
  }

  // Generate ASCII-style bar for percentages (like htop/btop)
  function generateBar(percentage, width = 30) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  // Generate smaller bar for compact display
  function generateCompactBar(percentage, width = 20) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '▓'.repeat(filled) + '░'.repeat(empty);
  }

  // Calculate nodes with apps percentage
  function getNodesWithAppsPercentage() {
    if (!safeTotalNodes || safeTotalNodes === 0) return 0;
    return (safeRunningApps.nodes_with_apps / safeTotalNodes) * 100;
  }

  function getMemoryStatus(percentage) {
    if (percentage >= 90) return 'CRITICAL';
    if (percentage >= 80) return 'HIGH';
    if (percentage >= 60) return 'MODERATE';
    return 'NORMAL';
  }

  function getStatusColor(status) {
    switch(status) {
      case 'CRITICAL': return 'var(--flux-red)';
      case 'HIGH': return 'var(--flux-orange)';
      case 'MODERATE': return 'var(--flux-purple)';
      default: return 'var(--flux-cyan)';
    }
  }
</script>

<div class="flux-panel">
  <div class="panel-header">
    <span>Network Resource Monitor</span>
    <span style="font-size: 12px; color: rgba(255,255,255,0.7);">Updated: {getLastUpdated()}</span>
  </div>
  
  <div class="panel-content">
    {#if loading}
      <div class="loading-section">
        <div class="loading-text">
          <div class="terminal-spinner large">⣾</div>
          <span>Loading network utilization data...</span>
        </div>
      </div>
    {:else}
      <!-- System Status Row -->
      <div class="metrics-row">
        <div class="metric-group">
          <div class="metric">
            <span class="metric-label">Network:</span>
            <span class="metric-value online">●</span>
          </div>
          <div class="metric">
            <span class="metric-label">Total Nodes:</span>
            <span class="metric-value">{formatNumber(safeTotalNodes)}</span>
          </div>
        </div>
        <div class="metric-group">
          <div class="metric">
            <span class="metric-label">Active:</span>
            <span class="metric-value">{formatNumber(safeUtilized.nodes)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Status:</span>
            <span class="metric-value online">ONLINE</span>
          </div>
        </div>
      </div>

      <!-- Main Resource Usage Section (htop-style) -->
      <div class="resource-section">
        <div class="resource-header">Resource Utilization:</div>
        
        <!-- CPU Usage -->
        <div class="resource-item">
          <div class="resource-info">
            <span class="resource-label">CPU</span>
            <span class="resource-usage">[{generateBar(safeUtilized.cores_percentage)}]</span>
            <span class="resource-percent" style="color: {getUtilizationColor(safeUtilized.cores_percentage)}">{formatPercentage(safeUtilized.cores_percentage)}</span>
          </div>
          <div class="resource-details">
            <span class="detail-text">{formatNumber(safeUtilized.cores)}/{formatNumber(safeTotal.cores)} cores</span>
            <span class="status-badge" style="color: {getStatusColor(getMemoryStatus(safeUtilized.cores_percentage))}">{getMemoryStatus(safeUtilized.cores_percentage)}</span>
          </div>
        </div>

        <!-- RAM Usage -->
        <div class="resource-item">
          <div class="resource-info">
            <span class="resource-label">RAM</span>
            <span class="resource-usage">[{generateBar(safeUtilized.ram_percentage)}]</span>
            <span class="resource-percent" style="color: {getUtilizationColor(safeUtilized.ram_percentage)}">{formatPercentage(safeUtilized.ram_percentage)}</span>
          </div>
          <div class="resource-details">
            <span class="detail-text">{formatBytes(safeUtilized.ram)}/{formatBytes(safeTotal.ram)}</span>
            <span class="status-badge" style="color: {getStatusColor(getMemoryStatus(safeUtilized.ram_percentage))}">{getMemoryStatus(safeUtilized.ram_percentage)}</span>
          </div>
        </div>

        <!-- SSD Usage -->
        <div class="resource-item">
          <div class="resource-info">
            <span class="resource-label">SSD</span>
            <span class="resource-usage">[{generateBar(safeUtilized.ssd_percentage)}]</span>
            <span class="resource-percent" style="color: {getUtilizationColor(safeUtilized.ssd_percentage)}">{formatPercentage(safeUtilized.ssd_percentage)}</span>
          </div>
          <div class="resource-details">
            <span class="detail-text">{formatBytes(safeUtilized.ssd)}/{formatBytes(safeTotal.ssd)}</span>
            <span class="status-badge" style="color: {getStatusColor(getMemoryStatus(safeUtilized.ssd_percentage))}">{getMemoryStatus(safeUtilized.ssd_percentage)}</span>
          </div>
        </div>
      </div>

      <!-- Network Stats Grid -->
      <div class="network-stats-section">
        <div class="stats-header">Network Statistics:</div>
        <div class="stats-grid">
          <!-- Active Nodes -->
          <div class="stat-item active-nodes">
            <div class="stat-header">
              <span class="stat-icon">🌐</span>
              <span class="stat-title">Active Nodes</span>
            </div>
            <div class="stat-content">
              <div class="stat-value">{formatNumber(safeUtilized.nodes)}</div>
              <div class="stat-bar-container">
                <div class="ascii-bar active">[{generateCompactBar(safeUtilized.nodes_percentage)}]</div>
                <span class="stat-percentage">{formatPercentage(safeUtilized.nodes_percentage)}</span>
              </div>
              <div class="stat-details">
                <span class="detail-label">of {formatNumber(safeTotalNodes)} total</span>
              </div>
            </div>
          </div>

          <!-- Idle Nodes -->
          <div class="stat-item idle-nodes">
            <div class="stat-header">
              <span class="stat-icon">💤</span>
              <span class="stat-title">Idle Nodes</span>
            </div>
            <div class="stat-content">
              <div class="stat-value">{formatNumber(safeTotalNodes - safeUtilized.nodes)}</div>
              <div class="stat-bar-container">
                <div class="ascii-bar idle">[{generateCompactBar(100 - safeUtilized.nodes_percentage)}]</div>
                <span class="stat-percentage">{formatPercentage(100 - safeUtilized.nodes_percentage)}</span>
              </div>
              <div class="stat-details">
                <span class="detail-label">available capacity</span>
              </div>
            </div>
          </div>

          <!-- Running Apps -->
          <div class="stat-item running-apps">
            <div class="stat-header">
              <span class="stat-icon">🐳</span>
              <span class="stat-title">Running Apps</span>
            </div>
            <div class="stat-content">
              <div class="stat-value">{formatNumber(safeRunningApps.total_apps)}</div>
              <div class="stat-bar-container">
                <div class="ascii-bar apps">[{generateCompactBar(getNodesWithAppsPercentage())}]</div>
                <span class="stat-percentage">{formatPercentage(getNodesWithAppsPercentage())}</span>
              </div>
              <div class="stat-details">
                <span class="detail-label">on {formatNumber(safeRunningApps.nodes_with_apps)} nodes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    {/if}
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

  /* Resource Section (htop-style) */
  .resource-section {
    margin-bottom: 20px;
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 15px;
  }

  .resource-header {
    color: var(--flux-text-dim);
    font-size: 12px;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .resource-item {
    margin-bottom: 10px;
    font-family: 'JetBrains Mono', monospace;
  }

  .resource-info {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .resource-label {
    color: var(--flux-text-dim);
    min-width: 35px;
    font-size: 12px;
    font-weight: 600;
  }

  .resource-usage {
    flex: 1;
    font-size: 11px;
    letter-spacing: 0.5px;
    color: var(--flux-cyan);
  }

  .resource-percent {
    min-width: 50px;
    text-align: right;
    font-size: 12px;
    font-weight: 600;
  }

  .resource-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    margin-left: 45px;
  }

  .detail-text {
    color: var(--flux-text-dim);
  }

  .status-badge {
    font-weight: 600;
    font-size: 9px;
    letter-spacing: 0.5px;
  }

  /* Network Stats Section */
  .network-stats-section {
    margin-bottom: 20px;
  }

  .stats-header {
    color: var(--flux-text-dim);
    font-size: 12px;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
  }

  .stat-item {
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 15px;
    transition: all 0.2s ease;
  }

  .stat-item:hover {
    border-color: var(--flux-blue);
    box-shadow: 0 0 8px rgba(92, 156, 204, 0.2);
  }

  .stat-item.active-nodes { border-left: 4px solid var(--flux-cyan); }
  .stat-item.idle-nodes { border-left: 4px solid var(--flux-purple); }
  .stat-item.running-apps { border-left: 4px solid var(--flux-green); }

  .stat-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .stat-icon {
    font-size: 16px;
  }

  .stat-title {
    color: var(--flux-text);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-content {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stat-value {
    color: var(--flux-text);
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 18px;
  }

  .stat-bar-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .ascii-bar {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    line-height: 1;
    letter-spacing: 0.5px;
    flex: 1;
  }

  .ascii-bar.active { color: var(--flux-cyan); }
  .ascii-bar.idle { color: var(--flux-purple); }
  .ascii-bar.apps { color: var(--flux-green); }

  .stat-percentage {
    color: var(--flux-text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 600;
    min-width: 40px;
    text-align: right;
  }

  .stat-details {
    margin-top: 4px;
  }

  .detail-label {
    color: var(--flux-text-muted);
    font-size: 10px;
  }

  .terminal-spinner {
    color: var(--flux-cyan);
    font-family: 'JetBrains Mono', monospace;
    animation: spin-chars 0.8s linear infinite;
  }

  .terminal-spinner.large {
    font-size: 18px;
    margin-right: 10px;
  }

  @keyframes spin-chars {
    0% { content: '⣾'; }
    10% { content: '⣽'; }
    20% { content: '⣻'; }
    30% { content: '⢿'; }
    40% { content: '⡿'; }
    50% { content: '⣟'; }
    60% { content: '⣯'; }
    70% { content: '⣷'; }
    80% { content: '⣾'; }
    90% { content: '⣽'; }
    100% { content: '⣻'; }
  }

  /* Loading Section */
  .loading-section {
    text-align: center;
    padding: 40px 20px;
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
  }

  .loading-text {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--flux-text-dim);
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
  }

  /* Responsive Design */
  @media (max-width: 1200px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 768px) {
    .metrics-row {
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }
    
    .stats-grid {
      grid-template-columns: 1fr;
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
    .resource-details {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .stat-bar-container {
      flex-direction: column;
      align-items: stretch;
      gap: 4px;
    }

    .stat-percentage {
      text-align: left;
    }

  }
</style>