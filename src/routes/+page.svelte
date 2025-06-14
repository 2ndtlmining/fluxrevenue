<script>
  import { onMount } from 'svelte';
  import RevenueStats from '$lib/components/RevenueStats.svelte';
  import NodeStats from '$lib/components/NodeStats.svelte';
  import Chart from '$lib/components/Chart.svelte';
  import NetworkUtilization from '$lib/components/NetworkUtilization.svelte';
  import SyncStatus from '$lib/components/SyncStatus.svelte';
  import RevenueTransactions from '$lib/components/RevenueTransactions.svelte';

  let revenueData = { daily: [], total: null };
  let nodeStats = {};
  let networkUtilizationStats = {
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
  let syncStats = {};
  let balance = 0;
  let loading = true;
  let lastDataUpdate = Date.now();
  
  let sampleTransactions = [];
  let trackedAddresses = [];
  let selectedAddress = 'all';
  let addressBreakdown = {};
  let showAddressBreakdown = false;

  // Enhanced system stats with real-time data
  let systemStats = {
    uptime: '22:37:53 up 17 days, 10:33',
    users: '0 user',
    loadAverage: 'load average: 1.33, 1.30, 1.42',
    memory: 'Mem: 137.38M',
    localIp: 'Local: 192.168.10.212',
    publicIp: 'Public: 122.119.118.40',
    apiPort: 'Api port: 16137',
    upnp: 'UPnP Enabled: True',
    // New technical stats
    os: 'Unknown',
    cpu: 'Unknown',
    totalRam: 'Unknown',
    dbSize: 'Unknown',
    cacheHits: 0,
    cacheMisses: 0,
    apiCalls: 0,
    wsConnections: 0,
    nodeVersion: 'Unknown'
  };

  let currentTime = new Date().toLocaleTimeString();
  let statsUpdateInterval;

  onMount(async () => {
    await loadData();
    await loadSampleTransactions();
    await loadSystemInfo(); // Load system information
    
    // Update time every second
    const timeInterval = setInterval(() => {
      currentTime = new Date().toLocaleTimeString();
    }, 1000);
    
    // Refresh data every 30 seconds
    const dataInterval = setInterval(async () => {
      await loadData();
      if (Date.now() - lastDataUpdate > 60000) {
        await loadSampleTransactions();
      }
    }, 30 * 1000);

    // Update system stats every 10 seconds
    statsUpdateInterval = setInterval(async () => {
      await loadSystemInfo();
      updateRuntimeStats();
    }, 10 * 1000);

    return () => {
      clearInterval(timeInterval);
      clearInterval(dataInterval);
      clearInterval(statsUpdateInterval);
    };
  });

  // Load system information from API or browser
  async function loadSystemInfo() {
    try {
      // Try to get system info from API first
      const response = await fetch('/api/system-info');
      if (response.ok) {
        const sysInfo = await response.json();
        systemStats = {
          ...systemStats,
          os: sysInfo.os || getClientSideOS(),
          cpu: sysInfo.cpu || 'Server CPU',
          totalRam: sysInfo.totalRam || 'Unknown',
          dbSize: sysInfo.dbSize || 'Unknown',
          nodeVersion: sysInfo.nodeVersion || process?.version || 'Unknown',
          localIp: sysInfo.localIp || systemStats.localIp,
          publicIp: sysInfo.publicIp || systemStats.publicIp,
          uptime: sysInfo.uptime || systemStats.uptime,
          loadAverage: sysInfo.loadAverage || systemStats.loadAverage,
          memory: sysInfo.memory || systemStats.memory
        };
      } else {
        // Fallback to client-side detection
        systemStats.os = getClientSideOS();
        systemStats.cpu = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : 'Unknown';
        systemStats.totalRam = navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown';
      }
    } catch (error) {
      console.error('Failed to load system info:', error);
      // Use client-side fallbacks
      systemStats.os = getClientSideOS();
      systemStats.cpu = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : 'Unknown';
      systemStats.totalRam = navigator.deviceMemory ? `${navigator.deviceMemory}GB` : 'Unknown';
    }
  }

  // Get OS information from user agent (client-side fallback)
  function getClientSideOS() {
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('windows')) return 'Windows';
    if (userAgent.includes('mac')) return 'macOS';
    if (userAgent.includes('linux')) return 'Linux';
    if (userAgent.includes('android')) return 'Android';
    if (userAgent.includes('ios')) return 'iOS';
    return 'Unknown OS';
  }

  // Update runtime statistics (simulated for demo)
  function updateRuntimeStats() {
    // Simulate incremental stats (replace with real API calls)
    systemStats.cacheHits += Math.floor(Math.random() * 10);
    systemStats.cacheMisses += Math.floor(Math.random() * 2);
    systemStats.apiCalls += Math.floor(Math.random() * 5);
    systemStats.wsConnections = Math.floor(Math.random() * 3) + 1;
    
    // Update DB size periodically (you'd get this from your API)
    if (Math.random() > 0.9) {
      const sizeInMB = 450 + Math.floor(Math.random() * 50);
      systemStats.dbSize = `${sizeInMB}MB`;
    }
  }

  async function loadData() {
    try {
      const revenueParams = new URLSearchParams({
        days: '30',
        breakdown: showAddressBreakdown ? 'true' : 'false'
      });
      
      if (selectedAddress !== 'all') {
        revenueParams.set('address', selectedAddress);
      }

      const [revenueRes, statsRes, syncRes] = await Promise.all([
        fetch(`/api/revenue?${revenueParams}`),
        fetch('/api/stats'),
        fetch('/api/sync-status').catch(() => null)
      ]);

      if (revenueRes.ok) {
        const newRevenueData = await revenueRes.json();
        
        if (showAddressBreakdown && newRevenueData.breakdown) {
          addressBreakdown = newRevenueData.breakdown;
          revenueData = {
            daily: [],
            total: {
              total: newRevenueData.summary?.total_revenue || 0,
              count: newRevenueData.summary?.total_count || 0
            }
          };
        } else {
          if (JSON.stringify(newRevenueData) !== JSON.stringify(revenueData)) {
            revenueData = newRevenueData;
            lastDataUpdate = Date.now();
            console.log('📊 Dashboard data updated');
          }
        }
        
        if (newRevenueData.addresses) {
          trackedAddresses = newRevenueData.addresses;
        }
      }

      if (statsRes.ok) {
        const stats = await statsRes.json();
        nodeStats = stats.node_stats || {};
        
        if (stats.network_utilization) {
          console.log('🌐 Raw network_utilization from server:', stats.network_utilization);
          
          networkUtilizationStats = {
            total: {
              cores: stats.network_utilization.total?.cores || 0,
              ram: stats.network_utilization.total?.ram || 0,
              ssd: stats.network_utilization.total?.ssd || 0
            },
            utilized: {
              cores: stats.network_utilization.utilized?.cores || 0,
              nodes: stats.network_utilization.utilized?.nodes || 0,
              ram: stats.network_utilization.utilized?.ram || 0,
              ssd: stats.network_utilization.utilized?.ssd || 0,
              cores_percentage: stats.network_utilization.utilized?.cores_percentage || 0,
              nodes_percentage: stats.network_utilization.utilized?.nodes_percentage || 0,
              ram_percentage: stats.network_utilization.utilized?.ram_percentage || 0,
              ssd_percentage: stats.network_utilization.utilized?.ssd_percentage || 0
            },
            running_apps: {
              total_apps: stats.network_utilization.running_apps?.total_apps || 0,
              nodes_with_apps: stats.network_utilization.running_apps?.nodes_with_apps || 0,
              watchtower_instances: stats.network_utilization.running_apps?.watchtower_instances || 0
            },
            total_nodes: stats.network_utilization.total_nodes || 0,
            last_updated: stats.network_utilization.last_updated || null
          };
          
          console.log('🌐 Processed networkUtilizationStats with running_apps:', networkUtilizationStats);
        }
        
        if (stats.addresses) {
          balance = stats.addresses.total_balance || 0;
          addressBreakdown.balances = stats.addresses.breakdown || [];
          trackedAddresses = stats.tracked_addresses || trackedAddresses;
        } else {
          balance = stats.balance || 0;
        }
        
        console.log('📊 Node stats loaded:', nodeStats);
        console.log('🌐 Network utilization stats loaded:', networkUtilizationStats);
      }

      if (syncRes && syncRes.ok) {
        const sync = await syncRes.json();
        syncStats = {
          currentHeight: sync.currentHeight || 0,
          networkHeight: sync.networkHeight || 0,
          blocksSynced: sync.blocksSynced || 0,
          blocksRemaining: sync.blocksRemaining || 0,
          progress: sync.progress || 0,
          isOnline: sync.isOnline || false,
          lastUpdate: Date.now()
        };
      } else {
        syncStats = {
          currentHeight: 0,
          networkHeight: 0,
          blocksSynced: 0,
          blocksRemaining: 0,
          progress: 0,
          isOnline: false,
          lastUpdate: Date.now()
        };
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      loading = false;
    }
  }

  async function loadSampleTransactions() {
    try {
      const params = new URLSearchParams({
        limit: '10',
        page: '1'
      });
      
      if (selectedAddress !== 'all') {
        params.set('address', selectedAddress);
      }
      
      const response = await fetch(`/api/transactions?${params}`);
      if (response.ok) {
        const data = await response.json();
        sampleTransactions = data.transactions || [];
        console.log('💰 Sample transactions loaded for RevenueStats:', sampleTransactions.length);
      }
    } catch (error) {
      console.error('Error loading sample transactions:', error);
      sampleTransactions = [];
    }
  }

  async function triggerSync() {
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      const result = await response.json();
      console.log('Sync result:', result);
      
      setTimeout(() => {
        loadData();
        loadSampleTransactions();
      }, 2000);
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  async function handleAddressChange() {
    loading = true;
    await loadData();
    await loadSampleTransactions();
  }

  async function toggleBreakdown() {
    showAddressBreakdown = !showAddressBreakdown;
    loading = true;
    await loadData();
    await loadSampleTransactions();
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      alert('Address copied to clipboard!');
    });
  }

  $: totalRevenue = revenueData.total?.total || 0;
  $: totalTransactions = revenueData.total?.count || 0;

  $: revenueStatsData = {
    currentBalance: balance,
    totalRevenue: totalRevenue,
    totalTransactions: totalTransactions
  };

  function getLastPaymentTime() {
    if (revenueData.daily && revenueData.daily.length > 0) {
      const lastPayment = revenueData.daily[revenueData.daily.length - 1];
      const date = new Date(lastPayment.date);
      const now = new Date();
      const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffHours < 1) return 'Less than 1 hour ago';
      if (diffHours < 24) return `${diffHours} hours ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} days ago`;
    }
    return 'No recent payments';
  }

  function formatAddress(address) {
    if (!address) return '';
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  }

  // Calculate cache hit ratio
  $: cacheHitRatio = systemStats.cacheHits + systemStats.cacheMisses > 0 
    ? ((systemStats.cacheHits / (systemStats.cacheHits + systemStats.cacheMisses)) * 100).toFixed(1)
    : '0.0';
</script>

<svelte:head>
  <title>Flux Revenue Tracker</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="terminal-container">
  <!-- Enhanced Terminal Header -->
  <header class="flux-header">
    <div class="header-main">
      <!-- ASCII Logo Section -->
      <div class="logo-section">
        <div class="flux-ascii-logo">
███████╗██╗     ██╗   ██╗██╗  ██╗    ██████╗ ███████╗██╗   ██╗███████╗███╗   ██╗██╗   ██╗███████╗
██╔════╝██║     ██║   ██║╚██╗██╔╝    ██╔══██╗██╔════╝██║   ██║██╔════╝████╗  ██║██║   ██║██╔════╝
█████╗  ██║     ██║   ██║ ╚███╔╝     ██████╔╝█████╗  ██║   ██║█████╗  ██╔██╗ ██║██║   ██║█████╗  
██╔══╝  ██║     ██║   ██║ ██╔██╗     ██╔══██╗██╔══╝  ╚██╗ ██╔╝██╔══╝  ██║╚██╗██║██║   ██║██╔══╝  
██║     ███████╗╚██████╔╝██╔╝ ██╗    ██║  ██║███████╗ ╚████╔╝ ███████╗██║ ╚████║╚██████╔╝███████╗
╚═╝     ╚══════╝ ╚═════╝ ╚═╝  ╚═╝    ╚═╝  ╚═╝╚══════╝  ╚═══╝  ╚══════╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝

████████╗██████╗  █████╗  ██████╗██╗  ██╗███████╗██████╗ 
╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝██╔════╝██╔══██╗
   ██║   ██████╔╝███████║██║     █████╔╝ █████╗  ██████╔╝
   ██║   ██╔══██╗██╔══██║██║     ██╔═██╗ ██╔══╝  ██╔══██╗
   ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗███████╗██║  ██║
   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
        </div>
        <div class="build-info">Build: revenue unicorn</div>
      </div>
      
      <!-- System Status Section -->
      <div class="system-status">
        <div class="status-row-top">
          <span>{systemStats.uptime}</span>
          <span>{systemStats.users}</span>
          <span>{systemStats.loadAverage}</span>
        </div>
        <div class="status-row-bottom">
          <span>{systemStats.memory}</span>
          <div class="status-indicators">
            <div class="status-indicator">
              <div class="status-dot" class:online={syncStats.isOnline}></div>
            </div>
            <div class="status-indicator">
              <div class="status-dot error-dot" class:active={!syncStats.isOnline}></div>
            </div>
          </div>
        </div>
        <!-- Additional System Info Row -->
        <div class="status-row-extended">
          <span>OS: {systemStats.os}</span>
          <span>CPU: {systemStats.cpu}</span>
          <span>DB: {systemStats.dbSize}</span>
          <span>Cache: {cacheHitRatio}%</span>
          <span>API: {systemStats.apiCalls}</span>
          <span>Port: {systemStats.apiPort.replace('Api port: ', '')}</span>
        </div>
      </div>
    </div>
  </header>

  <!-- Address Controls Panel -->
  {#if trackedAddresses.length > 0}
    <div class="flux-panel address-panel">
      <div class="panel-header">
        <span>Address Configuration</span>
        <span style="font-size: 12px; color: rgba(255,255,255,0.7);">Tracking {trackedAddresses.length} address{trackedAddresses.length === 1 ? '' : 'es'}</span>
      </div>
      <div class="panel-content">
        <div class="address-info">
          <div class="address-list">
            {#each trackedAddresses as address}
              <code class="address-code">{formatAddress(address)}</code>
            {/each}
          </div>
        </div>
        
        <div class="controls-row">
          <div class="address-selector">
            <label for="address-select">View:</label>
            <select id="address-select" bind:value={selectedAddress} on:change={handleAddressChange}>
              <option value="all">All Addresses Combined</option>
              {#each trackedAddresses as address}
                <option value={address}>{formatAddress(address)}</option>
              {/each}
            </select>
          </div>
          
          {#if trackedAddresses.length > 1}
            <button 
              class="terminal-btn" 
              class:active={showAddressBreakdown}
              on:click={toggleBreakdown}
            >
              {showAddressBreakdown ? 'Combined View' : 'Breakdown View'}
            </button>
          {/if}
          
          <button on:click={triggerSync} class="terminal-btn primary">Sync Now</button>
        </div>
      </div>
    </div>
  {:else}
    <div class="flux-panel address-panel">
      <div class="panel-header">
        <span>Address Configuration</span>
        <span style="font-size: 12px; color: rgba(255,255,255,0.7);">Loading...</span>
      </div>
      <div class="panel-content">
        <p>Loading address information...</p>
        <button on:click={triggerSync} class="terminal-btn primary">Sync Now</button>
      </div>
    </div>
  {/if}

  <!-- Sync Status - Fixed Position Top Right -->
  <SyncStatus syncData={syncStats} />

  {#if loading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Loading dashboard...</p>
    </div>
  {:else}
    <!-- Address Breakdown Cards (if enabled) -->
    {#if showAddressBreakdown && Object.keys(addressBreakdown).length > 0}
      <section class="breakdown-section">
        <div class="flux-panel">
          <div class="panel-header">
            <span>Address Breakdown</span>
          </div>
          <div class="panel-content">
            <div class="breakdown-grid">
              {#each Object.entries(addressBreakdown) as [address, data]}
                <div class="breakdown-card">
                  <h3>{formatAddress(address)}</h3>
                  <div class="breakdown-stats">
                    <div class="stat">
                      <span class="label">Balance:</span>
                      <span class="value">{data.total?.total?.toFixed(8) || 0} FLUX</span>
                    </div>
                    <div class="stat">
                      <span class="label">Transactions:</span>
                      <span class="value">{data.total?.count || 0}</span>
                    </div>
                    <div class="stat">
                      <span class="label">Daily Activity:</span>
                      <span class="value">{data.daily?.length || 0} days</span>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        </div>
      </section>
    {/if}

    <!-- Stats Section - Split into Revenue and Node Stats -->
    <section class="stats-section">
      <div class="stats-grid">
        <RevenueStats 
          stats={revenueStatsData} 
          transactions={sampleTransactions} 
          selectedAddress={selectedAddress}
        />
        <NodeStats stats={nodeStats} />
      </div>
    </section>

    <!-- Enhanced Chart Section -->
    <section class="chart-section">
      <Chart 
        data={revenueData.daily} 
        title="Revenue & Transaction Analytics"
        color="#60a5fa"
      />
    </section>

    <!-- Network Utilization Section -->
    {#if networkUtilizationStats && networkUtilizationStats.total_nodes > 0}
      <section class="network-section">
        <NetworkUtilization stats={networkUtilizationStats} loading={false} />
      </section>
    {:else}
      <section class="network-section">
        <NetworkUtilization stats={networkUtilizationStats} loading={true} />
      </section>
    {/if}

    <!-- Revenue Transactions Section -->
    <section class="transactions-section">
      <RevenueTransactions 
        selectedAddress={selectedAddress}
        loading={loading}
      />
    </section>
  {/if}

  <!-- Terminal Footer -->
  <footer class="flux-footer">
    <div class="footer-left">
      <div class="donation-info">
        <span class="donation-label">Donation Address:</span>
        <span class="donation-address" on:click={() => copyToClipboard('t1YourFluxDonationAddressHereForSupport123456789')} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && copyToClipboard('t1YourFluxDonationAddressHereForSupport123456789')}>
          t1ebxupkNYVQiswfwi7xBTwwKtioJqwLmUG
        </span>
      </div>
    </div>
    <div class="footer-right">
      <div class="version-info">
        <a href="https://github.com/2ndtlmining/fluxrevenue" target="_blank" rel="noopener noreferrer" class="github-link">
          <svg class="github-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          <span>GitHub</span>
        </a>
        <span class="version">v2.1.0</span>
      </div>
    </div>
  </footer>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
  
  :root {
    /* Authentic Flux Terminal Colors */
    --flux-bg: #0c1021;
    --flux-panel-bg: #131829;
    --flux-border: #2d5aa0;
    --flux-blue: #5c9ccc;
    --flux-light-blue: #7db3d9;
    --flux-bright-blue: #9cc5e6;
    --flux-text: #e8f4f8;
    --flux-text-dim: #8da3b0;
    --flux-text-muted: #5a6c78;
    --flux-green: #4ade80;
    --flux-green-bright: #22c55e;
    --flux-yellow: #fbbf24;
    --flux-orange: #f97316;
    --flux-red: #ef4444;
    --flux-purple: #a855f7;
    --flux-cyan: #06b6d4;
    
    /* Status colors matching FluxOS */
    --status-online: #22c55e;
    --status-warning: #fbbf24;
    --status-error: #ef4444;
    --status-info: #06b6d4;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    font-family: 'JetBrains Mono', monospace;
    background: var(--flux-bg);
    color: var(--flux-text);
    min-height: 100vh;
  }

  .terminal-container {
    max-width: 1600px;
    margin: 0 auto;
    padding: 20px;
    min-height: 100vh;
    position: relative;
  }

  /* Enhanced Header Layout */
  .flux-header {
    background: var(--flux-panel-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 20px;
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }

  .logo-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .flux-ascii-logo {
    font-size: 8px;
    line-height: 1.1;
    color: var(--flux-blue);
    text-shadow: 
        0 0 5px var(--flux-blue),
        0 0 10px var(--flux-blue),
        0 0 15px var(--flux-light-blue);
    font-family: 'JetBrains Mono', monospace;
    white-space: pre;
    animation: textGlow 4s ease-in-out infinite alternate;
    font-weight: 400;
    margin-bottom: 10px;
  }

  @keyframes textGlow {
    from { 
        text-shadow: 
            0 0 5px var(--flux-blue),
            0 0 10px var(--flux-blue),
            0 0 15px var(--flux-light-blue);
        color: var(--flux-blue);
    }
    to { 
        text-shadow: 
            0 0 8px var(--flux-light-blue),
            0 0 16px var(--flux-blue),
            0 0 24px var(--flux-bright-blue),
            0 0 32px var(--flux-blue);
        color: var(--flux-light-blue);
    }
  }

  .build-info {
    color: var(--flux-text-dim);
    font-size: 12px;
    margin-top: 5px;
  }

  .system-status {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    font-size: 12px;
    color: var(--flux-text-dim);
    font-family: 'JetBrains Mono', monospace;
  }

  .status-row-top, .status-row-bottom, .status-row-extended {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .status-row-extended {
    font-size: 11px;
    color: var(--flux-text-muted);
    margin-top: 4px;
  }

  .status-indicators {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-error);
    animation: pulse 2s infinite;
  }

  .status-dot.online {
    background: var(--status-online);
  }

  .error-dot {
    background: var(--status-error);
  }

  .error-dot.active {
    background: var(--status-error);
  }

  /* Flux Panel Styling */
  .flux-panel {
    background: var(--flux-panel-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 20px;
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

  /* Address Panel */
  .address-panel {
    margin-bottom: 20px;
  }

  .address-info {
    margin-bottom: 15px;
  }

  .address-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .address-code {
    background: var(--flux-bg);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--flux-border);
    font-family: 'JetBrains Mono', monospace;
    color: var(--flux-green);
    font-weight: 600;
    font-size: 0.875rem;
  }

  .controls-row {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
  }

  .address-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .address-selector label {
    color: var(--flux-text-dim);
    font-weight: 500;
  }

  .address-selector select {
    background: var(--flux-bg);
    color: var(--flux-text);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    min-width: 200px;
    font-family: 'JetBrains Mono', monospace;
  }

  .address-selector select:focus {
    outline: none;
    border-color: var(--flux-blue);
    box-shadow: 0 0 0 2px rgba(92, 156, 204, 0.2);
  }

  .terminal-btn {
    background: var(--flux-bg);
    color: var(--flux-text);
    border: 1px solid var(--flux-border);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.875rem;
  }

  .terminal-btn:hover {
    background: var(--flux-border);
    border-color: var(--flux-blue);
  }

  .terminal-btn.active {
    background: var(--flux-blue);
    border-color: var(--flux-blue);
    color: var(--flux-bg);
  }

  .terminal-btn.primary {
    background: var(--flux-green);
    border-color: var(--flux-green);
    color: var(--flux-bg);
  }

  .terminal-btn.primary:hover {
    background: var(--flux-green-bright);
    border-color: var(--flux-green-bright);
  }

  /* Loading */
  .loading {
    text-align: center;
    padding: 4rem 0;
    color: var(--flux-text);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--flux-border);
    border-left: 4px solid var(--flux-blue);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  /* Breakdown Section */
  .breakdown-section {
    margin-bottom: 20px;
  }

  .breakdown-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .breakdown-card {
    background: var(--flux-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 1.5rem;
  }

  .breakdown-card h3 {
    color: var(--flux-blue);
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
    font-family: 'JetBrains Mono', monospace;
  }

  .breakdown-stats {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .stat {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .stat .label {
    color: var(--flux-text-dim);
    font-size: 0.875rem;
  }

  .stat .value {
    color: var(--flux-text);
    font-weight: 600;
  }

  /* Footer Styling */
  .flux-footer {
    background: var(--flux-panel-bg);
    border: 1px solid var(--flux-border);
    border-radius: 4px;
    padding: 15px 20px;
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--flux-text-dim);
    flex-wrap: wrap;
    gap: 15px;
  }

  .footer-left {
    flex: 1;
  }

  .donation-info {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .donation-label {
    color: var(--flux-text);
    font-weight: 500;
  }

  .donation-address {
    color: var(--flux-green);
    font-family: 'JetBrains Mono', monospace;
    background: var(--flux-bg);
    padding: 4px 8px;
    border-radius: 3px;
    border: 1px solid var(--flux-border);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .donation-address:hover {
    background: var(--flux-border);
    color: var(--flux-text);
  }

  .footer-right {
    display: flex;
    align-items: center;
  }

  .version-info {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--flux-text-dim);
  }

  .github-link {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--flux-text-dim);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .github-link:hover {
    color: var(--flux-light-blue);
  }

  .github-icon {
    color: var(--flux-blue);
    transition: color 0.2s ease;
  }

  .github-link:hover .github-icon {
    color: var(--flux-light-blue);
  }

  .version {
    color: var(--flux-green);
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
  }

  /* Section spacing */
  section {
    margin-bottom: 20px;
  }

  .stats-section {
    margin-bottom: 20px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }

  .chart-section {
    margin-bottom: 20px;
  }

  .network-section {
    margin-bottom: 20px;
  }

  .transactions-section {
    margin-bottom: 20px;
  }

  /* Responsive Design */
  @media (max-width: 1200px) {
    .stats-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
    
    .breakdown-grid {
      grid-template-columns: 1fr;
    }

  }

  @media (max-width: 768px) {
    .terminal-container {
      padding: 10px;
    }
    
    .header-main {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    
    .logo-section {
      align-items: center;
    }
    
    .system-status {
      align-items: center;
      width: 100%;
    }

    .status-row-top, .status-row-bottom, .status-row-extended {
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
    }
    
    .controls-row {
      flex-direction: column;
      gap: 0.75rem;
    }

    .address-selector select {
      min-width: auto;
      width: 100%;
    }
    
    .flux-footer {
      flex-direction: column;
      align-items: flex-start;
      text-align: center;
    }
    
    .donation-info {
      flex-direction: column;
      align-items: center;
    }
    
    .donation-address {
      word-break: break-all;
    }

  }

  @media (max-width: 480px) {
    .flux-ascii-logo {
      font-size: 6px;
    }

  }

  /* Scrollbar Styling */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: var(--flux-bg);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--flux-border);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--flux-blue);
  }

</style>