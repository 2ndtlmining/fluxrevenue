<script>
  import { onMount } from 'svelte';

  export let data = [];
  export let title = "FLUX ANALYTICS TERMINAL";
  export let color = "#60a5fa";

  // Chart state
  let chartData = [];
  let loading = false;
  let error = null;
  let lastUpdate = null;

  // Configuration
  let dataSource = 'transactions';
  let timeRange = '30d';
  let selectedMetric = 'revenue';

  // Data source configuration
  const dataSourceConfig = {
    transactions: {
      label: 'TRANSACTION_DATA',
      prompt: 'flux-tx$',
      metrics: {
        revenue: { label: 'DAILY_REVENUE', unit: 'FLUX', color: '#22c55e', symbol: '▲' },
        count: { label: 'TX_COUNT', unit: 'tx', color: '#60a5fa', symbol: '●' },
        volume: { label: 'TX_VOLUME', unit: 'FLUX', color: '#a855f7', symbol: '◆' }
      }
    },
    node_stats: {
      label: 'NODE_STATISTICS',
      prompt: 'flux-nodes$',
      metrics: {
        total_nodes: { label: 'TOTAL_NODES', unit: 'nodes', color: '#60a5fa', symbol: '■' },
        cumulus_nodes: { label: 'CUMULUS_NODES', unit: 'nodes', color: '#22c55e', symbol: '▲' },
        nimbus_nodes: { label: 'NIMBUS_NODES', unit: 'nodes', color: '#f59e0b', symbol: '●' },
        stratus_nodes: { label: 'STRATUS_NODES', unit: 'nodes', color: '#ef4444', symbol: '◆' },
        arcane_nodes: { label: 'ARCANE_OS_NODES', unit: 'nodes', color: '#a855f7', symbol: '★' }
      }
    },
    network_utilization: {
      label: 'NETWORK_UTILIZATION',
      prompt: 'flux-util$',
      metrics: {
        cores_percentage: { label: 'CPU_UTIL', unit: '%', color: '#ef4444', symbol: '█' },
        ram_percentage: { label: 'RAM_UTIL', unit: '%', color: '#f59e0b', symbol: '▓' },
        ssd_percentage: { label: 'SSD_UTIL', unit: '%', color: '#22c55e', symbol: '▒' },
        running_apps: { label: 'RUNNING_APPS', unit: 'apps', color: '#f97316', symbol: '◆' }
      }
    }
  };

  // Time range options
  const timeRangeOptions = {
    '7d': { label: '7_DAYS', flag: '-7d' },
    '30d': { label: '30_DAYS', flag: '-30d' },
    '90d': { label: '90_DAYS', flag: '-90d' },
    '1y': { label: '1_YEAR', flag: '-1y' },
    'all': { label: 'ALL_TIME', flag: '--all' }
  };

  // Reactive values
  $: currentConfig = dataSourceConfig[dataSource];
  $: availableMetrics = currentConfig?.metrics || {};
  $: currentMetric = availableMetrics[selectedMetric];
  $: chartColor = currentMetric?.color || color;
  $: currentPrompt = currentConfig?.prompt || 'flux$';

  onMount(async () => {
    if (!selectedMetric || !availableMetrics[selectedMetric]) {
      selectedMetric = Object.keys(availableMetrics)[0] || 'revenue';
    }
    await loadChartData();
  });

  // Load data from API
  async function loadChartData() {
    loading = true;
    error = null;
    
    try {
      const params = new URLSearchParams({
        source: dataSource,
        metric: selectedMetric,
        range: timeRange
      });

      console.log(`${currentPrompt} fetch /api/chart-data?${params}`);
      
      const response = await fetch(`/api/chart-data?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      chartData = result.data || [];
      lastUpdate = new Date();
      
      console.log(`${currentPrompt} loaded ${chartData.length} data points`);
      
    } catch (err) {
      console.error(`${currentPrompt} ERROR:`, err.message);
      error = err.message;
      chartData = [];
    } finally {
      loading = false;
    }
  }

  // Handle changes
  async function handleDataSourceChange() {
    selectedMetric = Object.keys(availableMetrics)[0] || 'revenue';
    await loadChartData();
  }

  async function handleMetricChange() {
    await loadChartData();
  }

  async function handleTimeRangeChange() {
    await loadChartData();
  }

  async function refreshData() {
    await loadChartData();
  }

  // Format values
  function formatValue(value, metric, isAxisLabel = false) {
    if (!metric || value === null || value === undefined) return '0';
    
    const numValue = parseFloat(value) || 0;
    const unit = metric.unit;
    
    if (unit === 'FLUX') {
      if (isAxisLabel) {
        if (numValue >= 1) return `${numValue.toFixed(2)}`;
        if (numValue >= 0.01) return `${numValue.toFixed(3)}`;
        if (numValue >= 0.001) return `${numValue.toFixed(4)}`;
        return `${numValue.toFixed(6)}`;
      } else {
        return `${numValue.toFixed(6)} FLUX`;
      }
    } else if (unit === '%') {
      return isAxisLabel ? `${numValue.toFixed(1)}` : `${numValue.toFixed(1)}%`;
    } else if (['nodes', 'tx', 'apps'].includes(unit)) {
      const rounded = Math.round(numValue);
      return isAxisLabel ? `${rounded}` : `${rounded}${unit}`;
    }
    
    return numValue.toString();
  }

  // Export data
  function exportData() {
    if (!chartData.length) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `flux_${dataSource}_${selectedMetric}_${timeRange}_${timestamp}.csv`;
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Date,Value,Metric\n"
      + chartData.map(d => `${d.date},${d.value},${selectedMetric}`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`${currentPrompt} exported ${chartData.length} records`);
  }
</script>

<div class="terminal-chart">
  <!-- Terminal Header -->
  <div class="terminal-header">
    <div class="terminal-title">
      <span class="terminal-prompt">{currentPrompt}</span>
      <span class="terminal-command">analytics --interactive</span>
    </div>
    <div class="terminal-status">
      <span class="status-text">
        {loading ? 'LOADING...' : error ? 'ERROR' : 'READY'}
      </span>
      <div class="status-led" class:online={!loading && !error} class:error={error} class:loading={loading}></div>
    </div>
  </div>

  <!-- Terminal Commands -->
  <div class="terminal-body">
    <div class="terminal-commands">
      <div class="command-line">
        <span class="prompt">{currentPrompt}</span>
        <span class="command">select --source=</span>
        <select bind:value={dataSource} on:change={handleDataSourceChange} class="terminal-select">
          {#each Object.entries(dataSourceConfig) as [key, config]}
            <option value={key}>{config.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="command-line">
        <span class="prompt">{currentPrompt}</span>
        <span class="command">metric --type=</span>
        <select bind:value={selectedMetric} on:change={handleMetricChange} class="terminal-select">
          {#each Object.entries(availableMetrics) as [key, metric]}
            <option value={key}>{metric.label}</option>
          {/each}
        </select>
      </div>
      
      <div class="command-line">
        <span class="prompt">{currentPrompt}</span>
        <span class="command">range </span>
        <select bind:value={timeRange} on:change={handleTimeRangeChange} class="terminal-select">
          {#each Object.entries(timeRangeOptions) as [key, range]}
            <option value={key}>{range.flag}</option>
          {/each}
        </select>
      </div>
      
      <div class="command-line">
        <span class="prompt">{currentPrompt}</span>
        <button on:click={refreshData} class="terminal-button" disabled={loading}>
          {loading ? 'loading...' : 'refresh'}
        </button>
        <button on:click={exportData} class="terminal-button" disabled={loading || !chartData.length}>
          export
        </button>
      </div>
    </div>

    <!-- Terminal Output -->
    <div class="terminal-output">
      <div class="output-line">[{new Date().toISOString()}] FLUX Revenue Tracker - Network Analytics Terminal</div>
      <div class="output-line">Connected to: {currentConfig?.label || 'UNKNOWN'}</div>
      <div class="output-line">Active metric: {currentMetric?.label || 'NONE'} ({currentMetric?.unit || ''})</div>
      <div class="output-line">Time range: {timeRangeOptions[timeRange]?.label || timeRange}</div>
      <div class="output-line"></div>
      {#if chartData.length > 0}
        <div class="output-line">Data points loaded: {chartData.length}</div>
        <div class="output-line">Current value: {formatValue(chartData[chartData.length - 1]?.value || 0, currentMetric)}</div>
        <div class="output-line">Average: {formatValue(chartData.reduce((sum, d) => sum + (d?.value || 0), 0) / chartData.length, currentMetric)}</div>
      {:else}
        <div class="output-line">No data available for current selection</div>
      {/if}
    </div>

    <!-- Chart Display -->
    {#if loading}
      <div class="terminal-loading">
        <div class="loading-spinner">█▓▒░</div>
        <div>Loading {currentConfig?.label || 'data'}...</div>
      </div>
    {:else if error}
      <div class="terminal-error">
        <div>ERROR: {error}</div>
        <div class="error-prompt">
          <span class="prompt">{currentPrompt}</span>
          <button on:click={refreshData} class="terminal-button">retry</button>
        </div>
      </div>
    {:else if !chartData.length}
      <div class="terminal-empty">
        <div>No data available for current selection</div>
        <div>Try adjusting time range or metric selection</div>
      </div>
    {:else}
      <!-- SVG Chart -->
      <div class="terminal-chart-container">
        <div class="chart-header-info">
          <span class="metric-info">
            {currentMetric?.symbol || '█'} {currentMetric?.label || 'METRIC'} 
            ({formatValue(chartData[chartData.length - 1]?.value || 0, currentMetric)})
          </span>
          <span class="chart-range">
            [{chartData[0]?.date} → {chartData[chartData.length - 1]?.date}]
          </span>
        </div>
        
        <div class="chart-wrapper">
          <svg class="terminal-svg-chart" viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="terminalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:{chartColor};stop-opacity:0.3"/>
                <stop offset="100%" style="stop-color:{chartColor};stop-opacity:0.05"/>
              </linearGradient>
            </defs>
            
            <!-- Chart area background -->
            <rect x="80" y="40" width="680" height="300" fill="var(--flux-bg)" stroke="var(--flux-border)" stroke-width="1"/>
            
            <!-- Y-axis grid lines and labels -->
            {#each Array(6) as _, i}
              {@const yPos = 40 + (300 / 5) * i}
              {@const maxVal = Math.max(...chartData.map(d => d?.value || 0))}
              {@const minVal = Math.min(...chartData.map(d => d?.value || 0))}
              {@const value = maxVal - (maxVal - minVal) * i / 5}
              
              <line x1="80" y1={yPos} x2="760" y2={yPos} stroke="var(--flux-border)" stroke-width="0.5" opacity="0.5"/>
              <text x="75" y={yPos + 4} text-anchor="end" class="axis-text" fill="var(--flux-text-dim)">
                {formatValue(value, currentMetric, true)}
              </text>
            {/each}
            
            <!-- X-axis grid lines and labels -->
            {#each Array(Math.min(8, chartData.length)) as _, i}
              {@const dataIndex = Math.floor((chartData.length - 1) * i / Math.max(1, Math.min(7, chartData.length - 1)))}
              {@const xPos = 80 + (680 / Math.max(1, Math.min(7, chartData.length - 1))) * i}
              {@const date = chartData[dataIndex]?.date || ''}
              
              <line x1={xPos} y1="40" x2={xPos} y2="340" stroke="var(--flux-border)" stroke-width="0.5" opacity="0.3"/>
              <text x={xPos} y="360" text-anchor="middle" class="axis-text" fill="var(--flux-text-dim)">
                {date.slice(5)}
              </text>
            {/each}
            
            <!-- Chart line -->
            {#if chartData.length > 1}
              {@const minValue = Math.min(...chartData.map(d => d?.value || 0))}
              {@const maxValue = Math.max(...chartData.map(d => d?.value || 0))}
              {@const valueRange = maxValue - minValue || 1}
              
              {@const pathData = chartData.map((d, i) => {
                const x = 80 + (680 / (chartData.length - 1)) * i;
                const y = 340 - ((d?.value || 0) - minValue) / valueRange * 300;
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ')}
              
              {@const areaData = `M 80 340 L ${pathData.slice(2)} L ${80 + 680} 340 Z`}
              
              <!-- Area fill -->
              <path d={areaData} fill="url(#terminalGradient)"/>
              
              <!-- Main line -->
              <path d={pathData} fill="none" stroke={chartColor} stroke-width="2" stroke-linecap="round"/>
              
              <!-- Data points -->
              {#each chartData as point, i}
                {@const x = 80 + (680 / (chartData.length - 1)) * i}
                {@const y = 340 - ((point?.value || 0) - minValue) / valueRange * 300}
                
                <circle cx={x} cy={y} r="3" fill={chartColor} stroke="var(--flux-bg)" stroke-width="1" class="data-point">
                  <title>{point.date}: {formatValue(point.value, currentMetric)}</title>
                </circle>
              {/each}
            {/if}
            
            <!-- Chart border -->
            <rect x="80" y="40" width="680" height="300" fill="none" stroke="var(--flux-border)" stroke-width="1"/>
            
            <!-- Axes -->
            <line x1="80" y1="340" x2="760" y2="340" stroke="var(--flux-text-dim)" stroke-width="1"/>
            <line x1="80" y1="40" x2="80" y2="340" stroke="var(--flux-text-dim)" stroke-width="1"/>
            
            <!-- Axis labels -->
            <text x="420" y="385" text-anchor="middle" class="axis-label" fill="var(--flux-text)">DATE</text>
            <text x="25" y="190" text-anchor="middle" class="axis-label" fill="var(--flux-text)" transform="rotate(-90 25 190)">
              {currentMetric?.unit === 'FLUX' ? 'REVENUE (FLUX)' : `${currentMetric?.label || 'VALUE'} (${currentMetric?.unit || ''})`}
            </text>
          </svg>
        </div>
        
        <div class="chart-footer-info">
          <span>Min: {formatValue(Math.min(...chartData.map(d => d?.value || 0)), currentMetric)}</span>
          <span>Max: {formatValue(Math.max(...chartData.map(d => d?.value || 0)), currentMetric)}</span>
          <span>Avg: {formatValue(chartData.reduce((sum, d) => sum + (d?.value || 0), 0) / chartData.length, currentMetric)}</span>
          <span>Sum: {formatValue(chartData.reduce((sum, d) => sum + (d?.value || 0), 0), currentMetric)}</span>
          <span>Points: {chartData.length}</span>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .terminal-chart {
    background: var(--flux-panel-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    overflow: hidden;
  }

  .terminal-header {
    background: linear-gradient(135deg, var(--flux-border), var(--flux-blue));
    color: var(--flux-text);
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--flux-border);
  }

  .terminal-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 600;
  }

  .terminal-prompt {
    color: var(--flux-green);
    font-weight: 700;
  }

  .terminal-command {
    color: var(--flux-text-dim);
  }

  .terminal-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }

  .status-text {
    font-weight: 600;
    text-transform: uppercase;
  }

  .status-led {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--flux-red);
    animation: pulse 2s infinite;
  }

  .status-led.online {
    background: var(--flux-green);
  }

  .status-led.error {
    background: var(--flux-red);
  }

  .status-led.loading {
    background: var(--flux-yellow);
    animation: blink 0.5s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
  }

  .terminal-body {
    background: var(--flux-bg);
    padding: 20px;
    min-height: 400px;
  }

  .terminal-commands {
    margin-bottom: 20px;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--flux-border);
  }

  .command-line {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 8px;
    font-size: 12px;
  }

  .prompt {
    color: var(--flux-green);
    font-weight: 600;
    min-width: 80px;
  }

  .command {
    color: var(--flux-blue);
    font-weight: 500;
  }

  .terminal-select {
    background: var(--flux-panel-bg);
    color: var(--flux-text);
    border: 1px solid var(--flux-border);
    border-radius: 2px;
    padding: 2px 6px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
  }

  .terminal-select:focus {
    outline: none;
    border-color: var(--flux-blue);
    background: var(--flux-bg);
  }

  .terminal-button {
    background: var(--flux-panel-bg);
    color: var(--flux-text);
    border: 1px solid var(--flux-border);
    border-radius: 2px;
    padding: 2px 8px;
    font-size: 11px;
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
    text-transform: uppercase;
    margin-right: 8px;
    transition: all 0.2s ease;
  }

  .terminal-button:hover:not(:disabled) {
    background: var(--flux-border);
    border-color: var(--flux-blue);
  }

  .terminal-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .terminal-output {
    margin-bottom: 20px;
    padding: 10px;
    background: var(--flux-panel-bg);
    border: 1px solid var(--flux-border);
    border-radius: 2px;
  }

  .output-line {
    font-size: 11px;
    color: var(--flux-text-dim);
    margin-bottom: 2px;
    line-height: 1.4;
  }

  .terminal-loading,
  .terminal-error,
  .terminal-empty {
    text-align: center;
    padding: 40px 20px;
    color: var(--flux-text-dim);
    font-size: 12px;
  }

  .loading-spinner {
    font-size: 20px;
    color: var(--flux-blue);
    animation: spin 1s linear infinite;
    margin-bottom: 10px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .terminal-error {
    color: var(--flux-red);
  }

  .error-prompt {
    margin-top: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }

  .terminal-chart-container {
    margin-top: 20px;
  }

  .chart-header-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    font-size: 11px;
    color: var(--flux-text-dim);
  }

  .metric-info {
    color: var(--flux-text);
    font-weight: 600;
  }

  .chart-range {
    font-style: italic;
  }

  .chart-wrapper {
    background: var(--flux-panel-bg);
    border: 1px solid var(--flux-border);
    border-radius: 2px;
    padding: 10px;
    margin-bottom: 15px;
  }

  .terminal-svg-chart {
    width: 100%;
    height: auto;
    background: var(--flux-bg);
  }

  .axis-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    fill: var(--flux-text);
  }

  .axis-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .data-point {
    cursor: pointer;
    transition: r 0.2s ease;
  }

  .data-point:hover {
    r: 5;
  }

  .chart-footer-info {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 10px;
    color: var(--flux-text-dim);
    gap: 20px;
    flex-wrap: wrap;
    padding: 8px 12px;
    background: var(--flux-panel-bg);
    border: 1px solid var(--flux-border);
    border-radius: 2px;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .terminal-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }

    .terminal-status {
      align-self: flex-end;
    }

    .command-line {
      flex-wrap: wrap;
      gap: 3px;
    }

    .prompt {
      min-width: 60px;
    }

    .chart-header-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
    }

    .chart-footer-info {
      flex-direction: column;
      gap: 5px;
    }
  }
</style>