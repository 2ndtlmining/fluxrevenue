<script>
  import { onMount, onDestroy } from 'svelte';

  export let syncData = {
    currentHeight: 0,
    networkHeight: 0,
    blocksSynced: 0,
    blocksRemaining: 0,
    progress: 0,
    isOnline: false,
    lastUpdate: null,
    syncRate: 0,
    estimatedTimeRemaining: null,
    lastSyncMessage: null,
    newBlocksRemaining: 0,
    historicalBlocksRemaining: 0
  };

  let updateInterval;
  let isLoading = false;
  let connectionError = false;
  let isMinimized = true; // Start minimized

  $: progress = syncData?.progress || 0;
  $: isFullySynced = progress >= 99.9;
  $: statusColor = connectionError ? '#ef4444' : (isFullySynced ? '#10b981' : (syncData?.isOnline ? '#f59e0b' : '#6b7280'));
  $: statusText = connectionError ? 'Connection Error' : (isFullySynced ? 'Synced' : (syncData?.isOnline ? 'Syncing' : 'Offline'));

  async function fetchSyncStatus() {
    if (isLoading) return;
    
    isLoading = true;
    try {
      const response = await fetch('/api/sync-status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      // AGGRESSIVE data preservation - never let good data be overwritten with zeros/nulls
      const newSyncData = {
        // Always update these regardless
        networkHeight: data.currentHeight || syncData.networkHeight || 0,
        isOnline: data.isOnline !== false,
        lastUpdate: Date.now(),
        syncRate: data.syncRate || 0,
        lastSyncMessage: data.lastSyncMessage || syncData.lastSyncMessage || 'Waiting for sync...',
        estimatedTimeRemaining: data.estimatedTimeRemaining || syncData.estimatedTimeRemaining,
        
        // NEVER overwrite with zeros - only update if new value is BETTER
        currentHeight: (data.highestSynced && data.highestSynced > syncData.currentHeight) ? data.highestSynced : syncData.currentHeight,
        blocksSynced: (data.totalBlocksSynced && data.totalBlocksSynced > syncData.blocksSynced) ? data.totalBlocksSynced : syncData.blocksSynced,
        progress: (data.syncProgress && data.syncProgress > syncData.progress) ? data.syncProgress : syncData.progress,
        
        // For remaining blocks, only update if we have a reasonable value
        blocksRemaining: (typeof data.totalBlocksRemaining === 'number' && data.totalBlocksRemaining >= 0 && data.totalBlocksRemaining < 1000000) 
          ? data.totalBlocksRemaining 
          : syncData.blocksRemaining,
        newBlocksRemaining: (typeof data.newBlocksRemaining === 'number' && data.newBlocksRemaining >= 0 && data.newBlocksRemaining < 1000000) 
          ? data.newBlocksRemaining 
          : syncData.newBlocksRemaining,
        historicalBlocksRemaining: (typeof data.historicalBlocksRemaining === 'number' && data.historicalBlocksRemaining >= 0 && data.historicalBlocksRemaining < 1000000) 
          ? data.historicalBlocksRemaining 
          : syncData.historicalBlocksRemaining
      };
      
      // Only update syncData if we actually have improvements
      let hasImprovement = false;
      if (newSyncData.blocksSynced > syncData.blocksSynced) hasImprovement = true;
      if (newSyncData.progress > syncData.progress) hasImprovement = true;
      if (newSyncData.currentHeight > syncData.currentHeight) hasImprovement = true;
      
      // Always update status fields, but only update data fields if we have improvements or it's the first time
      if (hasImprovement || syncData.blocksSynced === 0) {
        syncData = newSyncData;
        // Save to localStorage only when we have good data
        try {
          localStorage.setItem('flux-sync-data', JSON.stringify(newSyncData));
        } catch (e) {
          console.warn('Failed to save sync data to localStorage');
        }
      } else {
        // Just update the status fields but keep the data
        syncData = {
          ...syncData,
          networkHeight: newSyncData.networkHeight,
          isOnline: newSyncData.isOnline,
          lastUpdate: newSyncData.lastUpdate,
          syncRate: newSyncData.syncRate,
          lastSyncMessage: newSyncData.lastSyncMessage,
          estimatedTimeRemaining: newSyncData.estimatedTimeRemaining
        };
      }
      
      connectionError = false;
      
    } catch (error) {
      console.error('Failed to fetch sync status:', error);
      connectionError = true;
      
      // Keep ALL existing data, just update connection status
      syncData = { 
        ...syncData, 
        isOnline: false, 
        lastUpdate: Date.now(),
        lastSyncMessage: `Connection error: ${error.message}`
      };
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    // Load minimized state from localStorage
    const savedMinimized = localStorage.getItem('syncStatus-minimized');
    if (savedMinimized !== null) {
      isMinimized = JSON.parse(savedMinimized);
    }
    
    // Load cached sync data from localStorage
    try {
      const cachedData = localStorage.getItem('flux-sync-data');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        // Only use cached data if it's recent (within last hour)
        const cacheAge = Date.now() - (parsedData.lastUpdate || 0);
        if (cacheAge < 60 * 60 * 1000) { // 1 hour
          syncData = { ...syncData, ...parsedData };
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached sync data');
    }
    
    // Fetch immediately on mount
    fetchSyncStatus();
    
    // Set up periodic updates every 30 seconds
    updateInterval = setInterval(fetchSyncStatus, 30000);
  });

  onDestroy(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });

  function toggleMinimized() {
    isMinimized = !isMinimized;
    // Save state to localStorage
    localStorage.setItem('syncStatus-minimized', JSON.stringify(isMinimized));
  }

  // Manual refresh function
  function manualRefresh(event) {
    event.stopPropagation(); // Prevent toggle
    fetchSyncStatus();
  }

  function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) {
      return '0';
    }
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatProgress(progress) {
    if (progress === null || progress === undefined || isNaN(progress)) {
      return '0.00%';
    }
    return progress.toFixed(2) + '%';
  }

  function formatTimeRemaining(minutes) {
    if (!minutes || minutes <= 0) return null;
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  }

  // Get next sync time estimate
  function getNextSyncTime() {
    if (!syncData.lastUpdate) return null;
    const nextSync = new Date(syncData.lastUpdate + (5 * 60 * 1000)); // 5 minutes from last update
    return nextSync.toLocaleTimeString();
  }
</script>

<div class="sync-status" 
     class:minimized={isMinimized}
     class:synced={isFullySynced} 
     class:syncing={!isFullySynced && syncData?.isOnline}
     class:error={connectionError}
     class:loading={isLoading}>
  
  <div class="status-header" on:click={toggleMinimized}>
    <div class="status-indicator" style="background-color: {statusColor}"></div>
    <span class="status-text">{statusText}</span>
    <div class="controls">
      {#if isLoading}
        <div class="loading-spinner"></div>
      {/if}
      <button class="refresh-btn" on:click={manualRefresh} title="Refresh" aria-label="Refresh">
        🔄
      </button>
      <button class="minimize-btn" aria-label={isMinimized ? 'Expand' : 'Minimize'}>
        {isMinimized ? '+' : '−'}
      </button>
    </div>
  </div>
  
  {#if !isMinimized}
    <div class="sync-stats">
      <div class="stat-row">
        <span class="label">Network Height:</span>
        <span class="value">{formatNumber(syncData?.networkHeight)}</span>
      </div>
      
      <div class="stat-row">
        <span class="label">Blocks Synced:</span>
        <span class="value">{formatNumber(syncData?.blocksSynced)}</span>
      </div>
      
      <div class="stat-row">
        <span class="label">Remaining:</span>
        <span class="value">{formatNumber(syncData?.blocksRemaining)}</span>
      </div>

      {#if syncData?.newBlocksRemaining > 0 || syncData?.historicalBlocksRemaining > 0}
        <div class="breakdown">
          <div class="breakdown-row">
            <span class="breakdown-label">↗️ New:</span>
            <span class="breakdown-value">{formatNumber(syncData?.newBlocksRemaining)}</span>
          </div>
          <div class="breakdown-row">
            <span class="breakdown-label">↙️ Historical:</span>
            <span class="breakdown-value">{formatNumber(syncData?.historicalBlocksRemaining)}</span>
          </div>
        </div>
      {/if}
      
      <div class="stat-row progress-row">
        <span class="label">Progress:</span>
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {progress}%"></div>
          </div>
          <span class="progress-text">{formatProgress(progress)}</span>
        </div>
      </div>

      {#if syncData?.estimatedTimeRemaining}
        <div class="stat-row">
          <span class="label">ETA:</span>
          <span class="value">{formatTimeRemaining(syncData.estimatedTimeRemaining)}</span>
        </div>
      {/if}
      
      {#if !syncData?.isOnline && getNextSyncTime()}
        <div class="stat-row">
          <span class="label">Next Sync:</span>
          <span class="value next-sync">{getNextSyncTime()}</span>
        </div>
      {/if}
    </div>
    
    {#if syncData?.lastSyncMessage}
      <div class="last-message">
        {syncData.lastSyncMessage}
      </div>
    {/if}
    
    {#if syncData?.lastUpdate}
      <div class="last-update">
        Updated: {new Date(syncData.lastUpdate).toLocaleTimeString()}
      </div>
    {/if}
  {/if}
</div>

<style>
  .sync-status {
    position: fixed;
    top: 1rem;
    right: 1rem;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    min-width: 200px;
    max-width: 320px;
    font-size: 0.75rem;
    color: white;
    backdrop-filter: blur(10px);
    z-index: 1000;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .sync-status.minimized {
    min-width: 180px;
    max-width: 180px;
  }

  .sync-status:hover {
    background: rgba(0, 0, 0, 0.9);
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  }

  .sync-status.synced {
    border-color: rgba(16, 185, 129, 0.5);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
  }

  .sync-status.syncing {
    border-color: rgba(245, 158, 11, 0.5);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2);
  }

  .sync-status.error {
    border-color: rgba(239, 68, 68, 0.5);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
  }

  .sync-status.loading {
    opacity: 0.9;
  }

  .status-header {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    cursor: pointer;
    user-select: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .minimized .status-header {
    border-bottom: none;
  }

  .status-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 0.5rem;
    animation: pulse 2s infinite;
    flex-shrink: 0;
  }

  .controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .minimize-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: bold;
    line-height: 1;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .minimize-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
  }

  .refresh-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.7rem;
    transition: all 0.2s ease;
    flex-shrink: 0;
  }

  .refresh-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: rotate(90deg);
  }

  .loading-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top: 2px solid white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    flex-shrink: 0;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .status-text {
    font-weight: 600;
    font-size: 0.8rem;
    flex: 1;
  }

  .sync-stats {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem;
    padding-top: 0.5rem;
  }

  .stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .progress-row {
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
  }

  .breakdown {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    padding: 0.25rem;
    margin: 0.25rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .breakdown-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .breakdown-label {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.65rem;
  }

  .breakdown-value {
    color: rgba(255, 255, 255, 0.8);
    font-weight: 500;
    font-family: 'Courier New', monospace;
    font-size: 0.65rem;
  }

  .label {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.7rem;
  }

  .value {
    color: white;
    font-weight: 600;
    font-family: 'Courier New', monospace;
    font-size: 0.7rem;
  }

  .next-sync {
    color: rgba(147, 197, 253, 1);
    font-weight: 500;
  }

  .progress-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .progress-bar {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3b82f6, #10b981);
    transition: width 0.5s ease;
    border-radius: 2px;
  }

  .progress-text {
    color: white;
    font-weight: 600;
    font-family: 'Courier New', monospace;
    font-size: 0.7rem;
    min-width: 45px;
    text-align: right;
  }

  .last-message {
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 4px;
    color: rgba(147, 197, 253, 1);
    font-size: 0.65rem;
    line-height: 1.2;
    word-break: break-word;
  }

  .last-update {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.5);
    font-size: 0.65rem;
    text-align: center;
  }

  .data-status {
    color: rgba(34, 197, 94, 0.8);
    font-weight: 500;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .sync-status {
      position: fixed;
      top: 1rem;
      right: 1rem;
      left: auto;
      width: auto;
      min-width: 160px;
      max-width: 280px;
    }
    
    .sync-status.minimized {
      min-width: 160px;
      max-width: 160px;
    }
  }

  /* Ensure it's not sticky/attached to scroll */
  .sync-status {
    position: fixed !important;
  }
</style>