import { API_CONFIG, getAllTargetAddresses, getMainAddress, PERFORMANCE_CONFIG } from './config.js';
import { dbUtils } from './db.js';

const { BASE_URL, MAX_CONCURRENT, ENABLE_CACHING, CACHE_SIZE, AGGRESSIVE_PARALLEL } = API_CONFIG;

// Performance tracking
let apiCallCount = 0;
let cacheHitCount = 0;
let batchTimes = [];

// Caching systems
const addressCache = new Map();
const blockCache = new Map();
let cacheCleanupInterval;

// Network stats cache with durations
let networkStatsCache = {
  nodeStats: { data: null, time: 0, duration: 5 * 60 * 1000 },
  arcaneStats: { data: null, time: 0, duration: 10 * 60 * 1000 },
  utilizationStats: { data: null, time: 0, duration: 3 * 60 * 1000 },
  combinedStats: { data: null, time: 0, duration: 5 * 60 * 1000 },
  runningAppsStats: { data: null, time: 0, duration: 2 * 60 * 1000 }
};

// Network stats collection state
let networkStatsCollectionState = {
  isRunning: false,
  lastCollectionTime: 0,
  lastSuccessTime: 0,
  consecutiveFailures: 0,
  collectionInterval: null,
  nextScheduledCollection: null
};

// Connection pooling
let activeConnections = 0;
const connectionQueue = [];

// Initialize caching system
if (ENABLE_CACHING) {
  cacheCleanupInterval = setInterval(() => {
    if (addressCache.size > CACHE_SIZE) {
      const keysToDelete = Array.from(addressCache.keys()).slice(0, addressCache.size - CACHE_SIZE);
      keysToDelete.forEach(key => addressCache.delete(key));
      console.log(`🧹 Cleaned address cache: removed ${keysToDelete.length} entries`);
    }
    if (blockCache.size > 1000) {
      blockCache.clear();
      console.log('🧹 Cleared block cache');
    }
  }, 30 * 60 * 1000);
}

// Enhanced API call wrapper with connection management
async function apiCall(url, options = {}) {
  if (activeConnections >= MAX_CONCURRENT) {
    await new Promise(resolve => connectionQueue.push(resolve));
  }
  
  activeConnections++;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.CONNECTION_TIMEOUT);
    
    const response = await fetch(url, {
      method: 'GET',
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FluxTracker/1.0)',
        'Accept': 'application/json',
        'Connection': 'keep-alive',
        ...options.headers
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    if (PERFORMANCE_CONFIG.TRACK_API_CALLS) apiCallCount++;
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${API_CONFIG.CONNECTION_TIMEOUT}ms`);
    }
    throw error;
  } finally {
    activeConnections--;
    if (connectionQueue.length > 0) {
      const resolve = connectionQueue.shift();
      resolve();
    }
  }
}

// Helper function for cache management
function getCachedData(cacheKey, duration) {
  const cache = networkStatsCache[cacheKey];
  const now = Date.now();
  
  if (cache.data && (now - cache.time) < duration) {
    console.log(`📊 Using cached ${cacheKey} (cache hit)`);
    cacheHitCount++;
    return cache.data;
  }
  return null;
}

function setCachedData(cacheKey, data) {
  networkStatsCache[cacheKey].data = data;
  networkStatsCache[cacheKey].time = Date.now();
}

export async function getCurrentBlockHeight() {
  try {
    console.log('🔍 Fetching current block height...');
    const response = await apiCall(`${BASE_URL}/daemon/getinfo`);
    const data = await response.json();
    
    if (data.status === 'success' && data.data?.blocks) {
      console.log(`📡 Current block height: ${data.data.blocks}`);
      return data.data.blocks;
    }
    
    console.warn('⚠️ Unexpected response format:', data);
    
    // Try fallback
    const fallbackResponse = await fetch(`${BASE_URL}/daemon/getblockcount`);
    const fallbackData = await fallbackResponse.json();
    
    if (fallbackData.status === 'success' && fallbackData.data) {
      console.log(`📡 Fallback block height: ${fallbackData.data}`);
      return fallbackData.data;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error getting current block height:', error.message);
    return null;
  }
}

export async function getBlockDataBatch(blockHeights) {
  if (!Array.isArray(blockHeights) || blockHeights.length === 0) return [];

  const startTime = Date.now();
  const cachedResults = [];
  const uncachedHeights = [];
  
  // Check cache first
  if (ENABLE_CACHING) {
    for (const height of blockHeights) {
      const cached = blockCache.get(height);
      if (cached) {
        cachedResults.push({ height, data: cached, cached: true });
        cacheHitCount++;
      } else {
        uncachedHeights.push(height);
      }
    }
  } else {
    uncachedHeights.push(...blockHeights);
  }

  // Fetch uncached blocks in parallel
  const fetchPromises = uncachedHeights.map(async (height) => {
    try {
      const response = await apiCall(`${BASE_URL}/daemon/getblock?hashheight=${height}`);
      const data = await response.json();
      const blockData = data.data || data;
      
      if (ENABLE_CACHING && blockData) {
        blockCache.set(height, blockData);
      }
      
      return { height, data: blockData, cached: false };
    } catch (error) {
      console.error(`Error getting block ${height}:`, error.message);
      return { height, data: null, error: error.message };
    }
  });

  const uncachedResults = await Promise.allSettled(fetchPromises);
  const processedResults = uncachedResults.map(result => 
    result.status === 'fulfilled' ? result.value : { height: null, data: null, error: result.reason?.message || 'Unknown error' }
  );

  const allResults = [...cachedResults, ...processedResults];
  allResults.sort((a, b) => (a.height || 0) - (b.height || 0));

  const elapsed = Date.now() - startTime;
  if (PERFORMANCE_CONFIG.MEASURE_BATCH_TIMES) {
    batchTimes.push(elapsed);
    const successCount = allResults.filter(r => r.data).length;
    const errorCount = allResults.filter(r => r.error).length;
    console.log(`⚡ Batch fetch: ${blockHeights.length} blocks in ${elapsed}ms (${cachedResults.length} cached, ${uncachedHeights.length} fetched, ${successCount} success, ${errorCount} errors)`);
  }

  return allResults;
}

// Backward compatibility
export async function getBlockData(blockHeight) {
  const results = await getBlockDataBatch([blockHeight]);
  return results[0]?.data || null;
}

export async function getBalance(address) {
  try {
    const targetAddress = address || getMainAddress();
    const response = await apiCall(`${BASE_URL}/explorer/balance/${targetAddress}`);
    const data = await response.json();
    return data.status === 'success' ? data.data / 100000000 : 0;
  } catch (error) {
    console.error('Error getting balance:', error);
    return 0;
  }
}

export async function getAllBalances() {
  const addresses = getAllTargetAddresses();
  const balancePromises = addresses.map(async (address) => {
    try {
      const balance = await getBalance(address);
      return { address, balance };
    } catch (error) {
      console.error(`Error getting balance for ${address}:`, error);
      return { address, balance: 0 };
    }
  });

  const results = await Promise.allSettled(balancePromises);
  const balances = {};
  
  results.forEach(result => {
    if (result.status === 'fulfilled') {
      const { address, balance } = result.value;
      balances[address] = balance;
    }
  });
  
  return balances;
}

export async function getNetworkStats() {
  try {
    const response = await apiCall(`${BASE_URL}/daemon/getinfo`);
    const info = await response.json();
    
    if (info.status === 'success') {
      return {
        blocks: info.data?.blocks || 0,
        difficulty: info.data?.difficulty || 0,
        hashrate: info.data?.networkhashps || 0,
        connections: info.data?.connections || 0,
        confirmations: 6, // Standard for Flux
      };
    }
    
    return {};
  } catch (error) {
    console.error('Error getting network stats:', error);
    return {};
  }
}

export async function getFluxNodeCount() {
  const cached = getCachedData('nodeStats', networkStatsCache.nodeStats.duration);
  if (cached) return cached;

  try {
    console.log('🔍 Fetching Flux node count...');
    const response = await apiCall('https://api.runonflux.io/daemon/getfluxnodecount');
    const data = await response.json();
    
    if (data.status === 'success' && data.data) {
      const nodeStats = {
        total: data.data.total || 0,
        cumulus: data.data['cumulus-enabled'] || 0,
        nimbus: data.data['nimbus-enabled'] || 0,
        stratus: data.data['stratus-enabled'] || 0
      };
      
      setCachedData('nodeStats', nodeStats);
      console.log('📊 Node count stats (fresh):', nodeStats);
      return nodeStats;
    }
    
    console.warn('⚠️ Failed to get node count data:', data);
    return { total: 0, cumulus: 0, nimbus: 0, stratus: 0 };
  } catch (error) {
    console.error('❌ Error fetching node count:', error);
    
    // Return cached data if available, even if expired
    if (networkStatsCache.nodeStats.data) {
      console.log('🔄 Using expired cache due to error');
      return networkStatsCache.nodeStats.data;
    }
    
    return { total: 0, cumulus: 0, nimbus: 0, stratus: 0 };
  }
}

export async function getArcaneOSStats() {
  const cached = getCachedData('arcaneStats', networkStatsCache.arcaneStats.duration);
  if (cached) return cached;

  try {
    console.log('🔍 Fetching ArcaneOS stats...');
    const response = await apiCall('https://stats.runonflux.io/fluxinfo?projection=flux');
    const data = await response.json();
    
    console.log('📡 ArcaneOS API Response status:', data.status);
    console.log('📡 ArcaneOS API Response data length:', data.data ? data.data.length : 'No data');
    
    if (data.status !== 'error' && data.data && Array.isArray(data.data)) {
      const totalNodes = data.data.length;
      
      const arcaneNodes = data.data.filter(node => {
        return node.flux && 
               node.flux.arcaneHumanVersion !== undefined && 
               node.flux.arcaneHumanVersion !== null && 
               node.flux.arcaneHumanVersion !== "";
      }).length;
      
      const percentage = totalNodes > 0 ? (arcaneNodes / totalNodes) * 100 : 0;
      
      const arcaneStats = {
        total_nodes: totalNodes,
        arcane_nodes: arcaneNodes,
        percentage: Math.round(percentage * 100) / 100
      };
      
      setCachedData('arcaneStats', arcaneStats);
      console.log('📊 ArcaneOS Stats (fresh):', {
        total: totalNodes,
        arcane: arcaneNodes,
        percentage: percentage.toFixed(2) + '%'
      });
      
      return arcaneStats;
    }
    
    console.warn('⚠️ ArcaneOS API returned error or no data:', data);
    return { total_nodes: 0, arcane_nodes: 0, percentage: 0 };
  } catch (error) {
    console.error('❌ Error fetching ArcaneOS stats:', error);
    
    if (networkStatsCache.arcaneStats.data) {
      console.log('🔄 Using expired ArcaneOS cache due to error');
      return networkStatsCache.arcaneStats.data;
    }
    
    return { total_nodes: 0, arcane_nodes: 0, percentage: 0 };
  }
}

export async function getRunningAppsStats() {
  const cached = getCachedData('runningAppsStats', networkStatsCache.runningAppsStats.duration);
  if (cached) return cached;

  try {
    console.log('🔍 Fetching running apps stats...');
    const response = await apiCall('https://stats.runonflux.io/fluxinfo?projection=apps.runningapps.Image');
    const data = await response.json();
    
    console.log('📡 Running Apps API Response status:', data.status);
    console.log('📡 Running Apps API Response data length:', data.data ? data.data.length : 'No data');
    
    if (data.status !== 'error' && data.data && Array.isArray(data.data)) {
      let totalRunningApps = 0;
      let watchtowerCount = 0;
      
      data.data.forEach((item) => {
        if (item.apps?.runningapps && Array.isArray(item.apps.runningapps)) {
          totalRunningApps += item.apps.runningapps.length;
          
          item.apps.runningapps.forEach((app) => {
            if (app.Image && (
              app.Image.includes('containrrr/watchtower:latest') || 
              app.Image.includes('containrrr/watchtower')
            )) {
              watchtowerCount++;
            }
          });
        }
      });
      
      const actualRunningApps = Math.max(0, totalRunningApps - watchtowerCount);
      
      const runningAppsStats = {
        total_apps: actualRunningApps,
        total_apps_including_watchtower: totalRunningApps,
        watchtower_instances: watchtowerCount,
        nodes_with_apps: data.data.filter(item => 
          item.apps?.runningapps && item.apps.runningapps.length > 0
        ).length,
        total_nodes_checked: data.data.length,
        last_updated: Date.now()
      };
      
      setCachedData('runningAppsStats', runningAppsStats);
      console.log('📊 Running Apps Stats (fresh):', {
        total: actualRunningApps,
        watchtower_excluded: watchtowerCount,
        nodes_with_apps: runningAppsStats.nodes_with_apps,
        total_nodes: runningAppsStats.total_nodes_checked
      });
      
      return runningAppsStats;
    }
    
    console.warn('⚠️ Running Apps API returned error or no data:', data);
    return {
      total_apps: 0,
      total_apps_including_watchtower: 0,
      watchtower_instances: 0,
      nodes_with_apps: 0,
      total_nodes_checked: 0,
      last_updated: Date.now()
    };
  } catch (error) {
    console.error('❌ Error fetching running apps stats:', error);
    
    if (networkStatsCache.runningAppsStats.data) {
      console.log('🔄 Using expired running apps cache due to error');
      return networkStatsCache.runningAppsStats.data;
    }
    
    return {
      total_apps: 0,
      total_apps_including_watchtower: 0,
      watchtower_instances: 0,
      nodes_with_apps: 0,
      total_nodes_checked: 0,
      last_updated: Date.now()
    };
  }
}

export async function getNetworkUtilizationStats() {
  const cached = getCachedData('utilizationStats', networkStatsCache.utilizationStats.duration);
  if (cached) return cached;

  try {
    console.log('🔍 Fetching network utilization stats...');
    
    const [resFluxNetworkUtils, resNodeBenchmarks, runningAppsStats] = await Promise.allSettled([
      apiCall('https://stats.runonflux.io/fluxinfo?projection=apps.resources'),
      apiCall('https://stats.runonflux.io/fluxinfo?projection=benchmark'),
      getRunningAppsStats()
    ]);

    const utilizationStats = {
      total: { cores: 0, ram: 0, ssd: 0 },
      utilized: { cores: 0, nodes: 0, ram: 0, ssd: 0, cores_percentage: 0, nodes_percentage: 0, ram_percentage: 0, ssd_percentage: 0 },
      running_apps: { total_apps: 0, nodes_with_apps: 0, watchtower_instances: 0 },
      total_nodes: 0,
      last_updated: Date.now()
    };

    // Add running apps data
    if (runningAppsStats.status === 'fulfilled') {
      const appsData = runningAppsStats.value;
      utilizationStats.running_apps = {
        total_apps: appsData.total_apps,
        nodes_with_apps: appsData.nodes_with_apps,
        watchtower_instances: appsData.watchtower_instances
      };
    }

    // Process network utilization data
    if (resFluxNetworkUtils.status === 'fulfilled') {
      const res = resFluxNetworkUtils.value;
      const json = await res.json();

      if (json.status !== 'error' && json.data) {
        utilizationStats.total_nodes = json.data.length;
        
        const emptyNodes = json.data.filter((data) => 
          data.apps?.resources?.appsRamLocked === 0
        ).length;

        utilizationStats.utilized.nodes = utilizationStats.total_nodes - emptyNodes;
        utilizationStats.utilized.ram = json.data.reduce((prev, current) => {
          return prev + (current.apps?.resources?.appsRamLocked || 0);
        }, 0) / 1000000;
        utilizationStats.utilized.cores = json.data.reduce((prev, current) => {
          return prev + (current.apps?.resources?.appsCpusLocked || 0);
        }, 0);
        utilizationStats.utilized.ssd = json.data.reduce((prev, current) => {
          return prev + (current.apps?.resources?.appsHddLocked || 0);
        }, 0) / 1000;

        if (utilizationStats.total_nodes > 0) {
          utilizationStats.utilized.nodes_percentage = 
            (utilizationStats.utilized.nodes / utilizationStats.total_nodes) * 100;
        }
      }
    }

    // Process benchmark data
    if (resNodeBenchmarks.status === 'fulfilled') {
      const res = resNodeBenchmarks.value;
      const json = await res.json();

      if (json.status !== 'error' && json.data) {
        let totalRam = 0, totalSsd = 0, totalCores = 0;

        for (const data of json.data) {
          const benchmark = data.benchmark?.bench;
          if (benchmark) {
            totalRam += benchmark.ram || 0;
            totalSsd += benchmark.ssd || 0;
            totalCores += benchmark.cores || 0;
          }
        }

        utilizationStats.total.ram = totalRam / 1000;
        utilizationStats.total.ssd = totalSsd / 1000;
        utilizationStats.total.cores = totalCores;

        // Calculate percentages
        if (utilizationStats.total.ram > 0) {
          utilizationStats.utilized.ram_percentage = 
            (utilizationStats.utilized.ram / utilizationStats.total.ram) * 100;
        }
        if (utilizationStats.total.ssd > 0) {
          utilizationStats.utilized.ssd_percentage = 
            (utilizationStats.utilized.ssd / utilizationStats.total.ssd) * 100;
        }
        if (utilizationStats.total.cores > 0) {
          utilizationStats.utilized.cores_percentage = 
            (utilizationStats.utilized.cores / utilizationStats.total.cores) * 100;
        }
      }
    }

    setCachedData('utilizationStats', utilizationStats);
    return utilizationStats;

  } catch (error) {
    console.error('❌ Error fetching network utilization stats:', error);
    
    if (networkStatsCache.utilizationStats.data) {
      console.log('🔄 Using expired utilization cache due to error');
      return networkStatsCache.utilizationStats.data;
    }
    
    return {
      total: { cores: 0, ram: 0, ssd: 0 },
      utilized: { cores: 0, nodes: 0, ram: 0, ssd: 0, cores_percentage: 0, nodes_percentage: 0, ram_percentage: 0, ssd_percentage: 0 },
      running_apps: { total_apps: 0, nodes_with_apps: 0, watchtower_instances: 0 },
      total_nodes: 0,
      last_updated: Date.now()
    };
  }
}

export async function getCombinedNodeStats() {
  const cached = getCachedData('combinedStats', networkStatsCache.combinedStats.duration);
  if (cached) return cached;

  try {
    console.log('🚀 Fetching combined node statistics...');
    
    const [nodeCount, arcaneStats] = await Promise.all([
      getFluxNodeCount(),
      getArcaneOSStats()
    ]);
    
    const combinedStats = {
      total: nodeCount.total,
      cumulus: nodeCount.cumulus,
      nimbus: nodeCount.nimbus,
      stratus: nodeCount.stratus,
      arcane_total: arcaneStats.total_nodes,
      arcane_nodes: arcaneStats.arcane_nodes,
      arcane_percentage: arcaneStats.percentage,
      cumulus_percentage: nodeCount.total > 0 ? Math.round((nodeCount.cumulus / nodeCount.total) * 10000) / 100 : 0,
      nimbus_percentage: nodeCount.total > 0 ? Math.round((nodeCount.nimbus / nodeCount.total) * 10000) / 100 : 0,
      stratus_percentage: nodeCount.total > 0 ? Math.round((nodeCount.stratus / nodeCount.total) * 10000) / 100 : 0,
      last_updated: Date.now()
    };
    
    setCachedData('combinedStats', combinedStats);
    console.log('✅ Combined node stats (fresh):', combinedStats);
    return combinedStats;
  } catch (error) {
    console.error('❌ Error fetching combined node stats:', error);
    
    if (networkStatsCache.combinedStats.data) {
      console.log('🔄 Using expired combined cache due to error');
      return networkStatsCache.combinedStats.data;
    }
    
    return {
      total: 0, cumulus: 0, nimbus: 0, stratus: 0,
      arcane_total: 0, arcane_nodes: 0, arcane_percentage: 0,
      cumulus_percentage: 0, nimbus_percentage: 0, stratus_percentage: 0,
      last_updated: Date.now()
    };
  }
}

// NEW: Network stats collection with robust error handling
export async function collectNetworkStatsSnapshot(forceCollection = false) {
  const shouldCollect = dbUtils.shouldTakeNetworkSnapshot();
  
  if (!forceCollection && !shouldCollect.should) {
    console.log(`📊 Skipping network stats collection: ${shouldCollect.reason}`);
    return { success: false, reason: shouldCollect.reason, skipped: true };
  }

  const snapshotTimestamp = shouldCollect.snapshotTimestamp || Math.floor(Date.now() / 1000);
  const collectionStart = Date.now();
  
  console.log(`🚀 Starting network stats collection for ${new Date(snapshotTimestamp * 1000).toISOString()}`);
  
  if (networkStatsCollectionState.isRunning) {
    console.log('⚠️ Network stats collection already in progress');
    return { success: false, reason: 'Collection already in progress' };
  }
  
  networkStatsCollectionState.isRunning = true;
  networkStatsCollectionState.lastCollectionTime = Date.now();
  
  try {
    // Collect stats with timeout
    const collectionPromises = [
      Promise.race([
        getCombinedNodeStats(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Node stats timeout')), 30000))
      ]),
      Promise.race([
        getNetworkUtilizationStats(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Utilization stats timeout')), 30000))
      ])
    ];
    
    const [nodeStatsResult, utilizationStatsResult] = await Promise.allSettled(collectionPromises);
    
    let nodeStats = null, utilizationStats = null;
    let apiSuccessRate = 0;
    let errors = [];
    
    // Process results
    if (nodeStatsResult.status === 'fulfilled') {
      nodeStats = nodeStatsResult.value;
      apiSuccessRate += 50;
      console.log('✅ Node stats collected successfully');
    } else {
      errors.push(`Node stats failed: ${nodeStatsResult.reason?.message || 'Unknown error'}`);
      console.error('❌ Failed to collect node stats:', nodeStatsResult.reason);
    }
    
    if (utilizationStatsResult.status === 'fulfilled') {
      utilizationStats = utilizationStatsResult.value;
      apiSuccessRate += 50;
      console.log('✅ Utilization stats collected successfully');
    } else {
      errors.push(`Utilization stats failed: ${utilizationStatsResult.reason?.message || 'Unknown error'}`);
      console.error('❌ Failed to collect utilization stats:', utilizationStatsResult.reason);
    }
    
    const notes = errors.length > 0 ? errors.join('; ') : null;
    let nodeStored = false, utilizationStored = false;
    
    // Store node stats if available and valid
    if (nodeStats && (nodeStats.total > 0 || nodeStats.arcane_nodes >= 0)) {
      try {
        nodeStored = dbUtils.storeNetworkNodeSnapshot(
          nodeStats,
          snapshotTimestamp,
          nodeStatsResult.status === 'fulfilled' ? 'api' : 'cache',
          nodeStatsResult.status === 'fulfilled' ? 100 : 0,
          nodeStatsResult.status === 'rejected' ? nodeStatsResult.reason?.message : null
        );
      } catch (error) {
        errors.push(`Failed to store node stats: ${error.message}`);
        console.error('❌ Failed to store node stats:', error);
      }
    }
    
    // Store utilization stats if available and valid
    if (utilizationStats && (utilizationStats.total_nodes > 0 || utilizationStats.total.cores > 0)) {
      try {
        utilizationStored = dbUtils.storeNetworkUtilizationSnapshot(
          utilizationStats,
          snapshotTimestamp,
          utilizationStatsResult.status === 'fulfilled' ? 'api' : 'cache',
          utilizationStatsResult.status === 'fulfilled' ? 100 : 0,
          utilizationStatsResult.status === 'rejected' ? utilizationStatsResult.reason?.message : null
        );
      } catch (error) {
        errors.push(`Failed to store utilization stats: ${error.message}`);
        console.error('❌ Failed to store utilization stats:', error);
      }
    }
    
    const elapsed = Date.now() - collectionStart;
    const success = nodeStored || utilizationStored;
    
    if (success) {
      networkStatsCollectionState.lastSuccessTime = Date.now();
      networkStatsCollectionState.consecutiveFailures = 0;
      console.log(`✅ Network stats collection completed in ${elapsed}ms (node: ${nodeStored}, utilization: ${utilizationStored})`);
    } else {
      networkStatsCollectionState.consecutiveFailures++;
      console.error(`❌ Network stats collection failed after ${elapsed}ms (${errors.length} errors)`);
    }
    
    return {
      success,
      timestamp: snapshotTimestamp,
      nodeStored,
      utilizationStored,
      apiSuccessRate,
      errors,
      elapsed,
      notes
    };
    
  } catch (error) {
    const elapsed = Date.now() - collectionStart;
    networkStatsCollectionState.consecutiveFailures++;
    console.error(`❌ Network stats collection crashed after ${elapsed}ms:`, error);
    
    return {
      success: false,
      error: error.message,
      elapsed,
      timestamp: snapshotTimestamp
    };
  } finally {
    networkStatsCollectionState.isRunning = false;
  }
}

// CONTINUATION FROM startNetworkStatsCollection function onwards

export function startNetworkStatsCollection() {
  if (networkStatsCollectionState.collectionInterval) {
    console.log('📊 Network stats collection already running');
    return;
  }
  
  console.log('🚀 Starting automated network stats collection (twice daily)');
  
  // Calculate next collection time (next 00:00 or 12:00 UTC)
  const now = new Date();
  const currentHour = now.getUTCHours();
  const nextHour = currentHour < 12 ? 12 : 24; // Next collection at 12:00 or 00:00
  const nextCollection = new Date(now);
  nextCollection.setUTCHours(nextHour % 24, 0, 0, 0);
  
  if (nextHour === 24) {
    nextCollection.setUTCDate(nextCollection.getUTCDate() + 1);
  }
  
  networkStatsCollectionState.nextScheduledCollection = nextCollection;
  
  console.log(`📅 Next network stats collection scheduled for: ${nextCollection.toISOString()}`);
  
  // Check every 5 minutes if it's time to collect
  networkStatsCollectionState.collectionInterval = setInterval(async () => {
    try {
      const shouldCollect = dbUtils.shouldTakeNetworkSnapshot();
      
      if (shouldCollect.should) {
        console.log('⏰ Scheduled network stats collection triggered');
        await collectNetworkStatsSnapshot();
        
        // Update next collection time
        const nextTime = new Date(networkStatsCollectionState.nextScheduledCollection);
        nextTime.setUTCHours(nextTime.getUTCHours() + 12); // Add 12 hours
        networkStatsCollectionState.nextScheduledCollection = nextTime;
        
        console.log(`📅 Next network stats collection scheduled for: ${nextTime.toISOString()}`);
      }
    } catch (error) {
      console.error('❌ Error in scheduled network stats collection:', error);
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
  
  // Take an initial snapshot if we don't have recent data
  setTimeout(async () => {
    try {
      const syncStatus = dbUtils.getCurrentSyncStatus();
      const latestNodeStats = syncStatus?.latestNodeStats;
      const latestUtilizationStats = syncStatus?.latestUtilizationStats;
      
      const hasRecentData = latestNodeStats && latestUtilizationStats && 
        (Date.now() - (latestNodeStats.timestamp * 1000)) < (6 * 60 * 60 * 1000); // 6 hours
      
      if (!hasRecentData) {
        console.log('🔄 Taking initial network stats snapshot (no recent data found)');
        await collectNetworkStatsSnapshot(true); // Force collection
      }
    } catch (error) {
      console.error('❌ Error taking initial network stats snapshot:', error);
    }
  }, 10000); // Wait 10 seconds after startup
}

// NEW: Stop automated network stats collection
export function stopNetworkStatsCollection() {
  if (networkStatsCollectionState.collectionInterval) {
    clearInterval(networkStatsCollectionState.collectionInterval);
    networkStatsCollectionState.collectionInterval = null;
    console.log('🛑 Stopped automated network stats collection');
  }
}

// NEW: Get network stats collection status
export function getNetworkStatsCollectionStatus() {
  return {
    ...networkStatsCollectionState,
    isScheduled: !!networkStatsCollectionState.collectionInterval,
    timeSinceLastCollection: networkStatsCollectionState.lastCollectionTime ? 
      Date.now() - networkStatsCollectionState.lastCollectionTime : null,
    timeSinceLastSuccess: networkStatsCollectionState.lastSuccessTime ? 
      Date.now() - networkStatsCollectionState.lastSuccessTime : null,
    nextCollectionIn: networkStatsCollectionState.nextScheduledCollection ? 
      networkStatsCollectionState.nextScheduledCollection.getTime() - Date.now() : null
  };
}

/**
 * Enhanced function to analyze block data and extract complete transaction information
 */
export function analyzeBlockForAddresses(blockData, targetAddresses = null) {
  const addresses = targetAddresses || getAllTargetAddresses();
  if (!blockData?.tx || addresses.length === 0) {
    return { transactions: [], count: 0, value: 0, addressBreakdown: {} };
  }
  
  const transactions = [];
  const addressBreakdown = {};
  
  addresses.forEach(addr => {
    addressBreakdown[addr] = { count: 0, value: 0, transactions: [] };
  });
  
  const addressSet = new Set(addresses);
  
  for (const tx of blockData.tx) {
    if (tx.vin && tx.vin.length > 0 && tx.vin[0].coinbase) {
      continue;
    }
    
    const foundPayments = [];
    
    for (let i = 0; i < (tx.vout || []).length; i++) {
      const output = tx.vout[i];
      const outputAddresses = output.scriptPubKey?.addresses || [];
      
      for (const outputAddr of outputAddresses) {
        if (addressSet.has(outputAddr)) {
          foundPayments.push({
            targetAddress: outputAddr,
            voutIndex: i,
            value: output.value || 0
          });
        }
      }
    }
    
    if (foundPayments.length > 0) {
      let fromAddress = 'Unknown';
      
      if (tx.vin && tx.vin.length > 0) {
        const firstInput = tx.vin[0];
        
        if (firstInput.address) {
          fromAddress = firstInput.address;
        } else if (firstInput.scriptSig && firstInput.scriptSig.address) {
          fromAddress = firstInput.scriptSig.address;
        } else if (firstInput.txid && firstInput.vout !== undefined) {
          fromAddress = `prev:${firstInput.txid}:${firstInput.vout}`;
        }
      }
      
      for (const payment of foundPayments) {
        const transaction = {
          id: tx.txid,
          from: fromAddress,
          to: payment.targetAddress,
          amount: payment.value,
          date: blockData.time ? new Date(blockData.time * 1000).toISOString() : null,
          blockHeight: blockData.height,
          blockHash: blockData.hash,
          confirmations: blockData.confirmations || 0,
          voutIndex: payment.voutIndex,
          vinCount: tx.vin ? tx.vin.length : 0,
          voutCount: tx.vout ? tx.vout.length : 0,
          version: tx.version,
          locktime: tx.locktime
        };
        
        transactions.push(transaction);
        addressBreakdown[payment.targetAddress].count++;
        addressBreakdown[payment.targetAddress].value += payment.value;
        addressBreakdown[payment.targetAddress].transactions.push(transaction);
      }
    }
  }
  
  return {
    transactions,
    count: transactions.length,
    value: transactions.reduce((sum, tx) => sum + tx.amount, 0),
    addressBreakdown
  };
}

/**
 * Batch analyze multiple blocks for transactions to target addresses
 */
export function analyzeBlocksBatch(blockResults, targetAddresses = null) {
  const addresses = targetAddresses || getAllTargetAddresses();
  
  if (!blockResults || blockResults.length === 0 || addresses.length === 0) {
    return { 
      transactions: [], 
      count: 0, 
      value: 0, 
      addressBreakdown: {},
      blocksAnalyzed: 0,
      blocksWithTransactions: 0
    };
  }
  
  const allTransactions = [];
  const addressBreakdown = {};
  let blocksAnalyzed = 0;
  let blocksWithTransactions = 0;
  
  // Initialize address breakdown
  addresses.forEach(addr => {
    addressBreakdown[addr] = { count: 0, value: 0, transactions: [] };
  });
  
  // Process each block result
  for (const blockResult of blockResults) {
    if (!blockResult.data) continue;
    
    blocksAnalyzed++;
    const analysis = analyzeBlockForAddresses(blockResult.data, addresses);
    
    if (analysis.transactions.length > 0) {
      blocksWithTransactions++;
      allTransactions.push(...analysis.transactions);
      
      // Merge address breakdown
      for (const [address, breakdown] of Object.entries(analysis.addressBreakdown)) {
        if (addressBreakdown[address]) {
          addressBreakdown[address].count += breakdown.count;
          addressBreakdown[address].value += breakdown.value;
          addressBreakdown[address].transactions.push(...breakdown.transactions);
        }
      }
    }
  }
  
  return {
    transactions: allTransactions,
    count: allTransactions.length,
    value: allTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    addressBreakdown,
    blocksAnalyzed,
    blocksWithTransactions
  };
}

export function analyzeBlockForAddress(blockData, targetAddress) {
  const addresses = targetAddress ? [targetAddress] : [getMainAddress()];
  const result = analyzeBlockForAddresses(blockData, addresses);
  
  return {
    transactions: result.transactions,
    count: result.count,
    value: result.value
  };
}

export async function resolveFromAddress(txid, voutIndex) {
  const cacheKey = `${txid}:${voutIndex}`;
  
  if (ENABLE_CACHING && addressCache.has(cacheKey)) {
    cacheHitCount++;
    return addressCache.get(cacheKey);
  }
  
  try {
    const response = await apiCall(`${BASE_URL}/daemon/getrawtransaction?txid=${txid}&decrypt=1`);
    const data = await response.json();
    
    let resolvedAddress = 'Unknown';
    
    if (data.status === 'success' && data.data && data.data.vout && data.data.vout[voutIndex]) {
      const output = data.data.vout[voutIndex];
      const addresses = output.scriptPubKey?.addresses || [];
      resolvedAddress = addresses[0] || 'Unknown';
    }
    
    if (ENABLE_CACHING) {
      addressCache.set(cacheKey, resolvedAddress);
    }
    
    return resolvedAddress;
  } catch (error) {
    console.error('Error resolving from address:', error);
    const fallbackResult = 'Unknown';
    
    if (ENABLE_CACHING) {
      addressCache.set(cacheKey, fallbackResult);
    }
    
    return fallbackResult;
  }
}

export async function enhanceTransactionsWithFromAddresses(transactions) {
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const needResolution = [];
  const alreadyResolved = [];
  
  for (const tx of transactions) {
    if (tx.from && tx.from.startsWith('prev:')) {
      needResolution.push(tx);
    } else {
      alreadyResolved.push(tx);
    }
  }

  if (needResolution.length === 0) {
    return transactions;
  }

  console.log(`🔍 Resolving ${needResolution.length} from addresses in parallel...`);

  const batchSize = Math.min(API_CONFIG.MAX_CONCURRENT, 15);
  const batches = [];
  
  for (let i = 0; i < needResolution.length; i += batchSize) {
    batches.push(needResolution.slice(i, i + batchSize));
  }

  const resolvedTransactions = [];
  
  for (const batch of batches) {
    const batchPromises = batch.map(async (tx) => {
      try {
        const parts = tx.from.replace('prev:', '').split(':');
        const prevTxId = parts[0];
        const voutIndex = parseInt(parts[1]) || 0;
        
        const resolvedAddress = await resolveFromAddress(prevTxId, voutIndex);
        return { ...tx, from: resolvedAddress, fromResolved: true };
      } catch (error) {
        console.error('Error resolving from address:', error);
        return { ...tx, from: 'Unknown' };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    const successfulResults = batchResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    resolvedTransactions.push(...successfulResults);
    
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.REQUEST_DELAY));
    }
  }

  return [...alreadyResolved, ...resolvedTransactions];
}

export async function batchResolveFromAddresses(transactions, batchSize = null) {
  if (!AGGRESSIVE_PARALLEL) {
    return enhanceTransactionsWithFromAddresses(transactions);
  }

  const actualBatchSize = batchSize || Math.min(API_CONFIG.MAX_CONCURRENT, 20);
  
  if (!transactions || transactions.length === 0) {
    return [];
  }

  const startTime = Date.now();
  const enhancedTransactions = [];
  
  for (let i = 0; i < transactions.length; i += actualBatchSize) {
    const batch = transactions.slice(i, i + actualBatchSize);
    const batchPromises = batch.map(async (tx) => {
      if (tx.from && tx.from.startsWith('prev:')) {
        try {
          const parts = tx.from.replace('prev:', '').split(':');
          const prevTxId = parts[0];
          const voutIndex = parseInt(parts[1]) || 0;
          const resolvedAddress = await resolveFromAddress(prevTxId, voutIndex);
          return { ...tx, from: resolvedAddress, fromResolved: true };
        } catch (error) {
          return { ...tx, from: 'Unknown' };
        }
      }
      return tx;
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    const successfulResults = batchResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value);
    
    enhancedTransactions.push(...successfulResults);
  }

  const elapsed = Date.now() - startTime;
  console.log(`⚡ Batch address resolution: ${transactions.length} transactions in ${elapsed}ms`);
  
  return enhancedTransactions;
}

// Performance monitoring functions
export function getPerformanceStats() {
  const avgBatchTime = batchTimes.length > 0 ? 
    batchTimes.reduce((sum, time) => sum + time, 0) / batchTimes.length : 0;
  
  const now = Date.now();
  const networkCacheStatus = {
    nodeStats: networkStatsCache.nodeStats.data ? 
      (now - networkStatsCache.nodeStats.time < networkStatsCache.nodeStats.duration ? 'fresh' : 'expired') : 'empty',
    arcaneStats: networkStatsCache.arcaneStats.data ? 
      (now - networkStatsCache.arcaneStats.time < networkStatsCache.arcaneStats.duration ? 'fresh' : 'expired') : 'empty',
    utilizationStats: networkStatsCache.utilizationStats.data ? 
      (now - networkStatsCache.utilizationStats.time < networkStatsCache.utilizationStats.duration ? 'fresh' : 'expired') : 'empty',
    combinedStats: networkStatsCache.combinedStats.data ? 
      (now - networkStatsCache.combinedStats.time < networkStatsCache.combinedStats.duration ? 'fresh' : 'expired') : 'empty',
    runningAppsStats: networkStatsCache.runningAppsStats.data ? 
      (now - networkStatsCache.runningAppsStats.time < networkStatsCache.runningAppsStats.duration ? 'fresh' : 'expired') : 'empty'
  };
  
  return {
    apiCallCount,
    cacheHitCount,
    cacheHitRate: apiCallCount > 0 ? (cacheHitCount / apiCallCount) * 100 : 0,
    avgBatchTime: Math.round(avgBatchTime),
    activeConnections,
    queuedConnections: connectionQueue.length,
    cacheSize: addressCache.size,
    blockCacheSize: blockCache.size,
    networkCacheStatus,
    networkStatsCollection: getNetworkStatsCollectionStatus()
  };
}

export function resetPerformanceStats() {
  apiCallCount = 0;
  cacheHitCount = 0;
  batchTimes.length = 0;
  console.log('📊 Performance stats reset');
}

// Cache management functions
export function clearNetworkStatsCache() {
  networkStatsCache = {
    nodeStats: { data: null, time: 0, duration: 5 * 60 * 1000 },
    arcaneStats: { data: null, time: 0, duration: 10 * 60 * 1000 },
    utilizationStats: { data: null, time: 0, duration: 3 * 60 * 1000 },
    combinedStats: { data: null, time: 0, duration: 5 * 60 * 1000 },
    runningAppsStats: { data: null, time: 0, duration: 2 * 60 * 1000 }
  };
  console.log('🧹 Network stats cache cleared');
}

export function getNetworkCacheInfo() {
  const now = Date.now();
  return {
    nodeStats: {
      cached: !!networkStatsCache.nodeStats.data,
      age: networkStatsCache.nodeStats.time ? now - networkStatsCache.nodeStats.time : 0,
      fresh: networkStatsCache.nodeStats.time ? (now - networkStatsCache.nodeStats.time) < networkStatsCache.nodeStats.duration : false,
      expiresIn: networkStatsCache.nodeStats.time ? Math.max(0, networkStatsCache.nodeStats.duration - (now - networkStatsCache.nodeStats.time)) : 0
    },
    arcaneStats: {
      cached: !!networkStatsCache.arcaneStats.data,
      age: networkStatsCache.arcaneStats.time ? now - networkStatsCache.arcaneStats.time : 0,
      fresh: networkStatsCache.arcaneStats.time ? (now - networkStatsCache.arcaneStats.time) < networkStatsCache.arcaneStats.duration : false,
      expiresIn: networkStatsCache.arcaneStats.time ? Math.max(0, networkStatsCache.arcaneStats.duration - (now - networkStatsCache.arcaneStats.time)) : 0
    },
    utilizationStats: {
      cached: !!networkStatsCache.utilizationStats.data,
      age: networkStatsCache.utilizationStats.time ? now - networkStatsCache.utilizationStats.time : 0,
      fresh: networkStatsCache.utilizationStats.time ? (now - networkStatsCache.utilizationStats.time) < networkStatsCache.utilizationStats.duration : false,
      expiresIn: networkStatsCache.utilizationStats.time ? Math.max(0, networkStatsCache.utilizationStats.duration - (now - networkStatsCache.utilizationStats.time)) : 0
    },
    combinedStats: {
      cached: !!networkStatsCache.combinedStats.data,
      age: networkStatsCache.combinedStats.time ? now - networkStatsCache.combinedStats.time : 0,
      fresh: networkStatsCache.combinedStats.time ? (now - networkStatsCache.combinedStats.time) < networkStatsCache.combinedStats.duration : false,
      expiresIn: networkStatsCache.combinedStats.time ? Math.max(0, networkStatsCache.combinedStats.duration - (now - networkStatsCache.combinedStats.time)) : 0
    },
    runningAppsStats: {
      cached: !!networkStatsCache.runningAppsStats.data,
      age: networkStatsCache.runningAppsStats.time ? now - networkStatsCache.runningAppsStats.time : 0,
      fresh: networkStatsCache.runningAppsStats.time ? (now - networkStatsCache.runningAppsStats.time) < networkStatsCache.runningAppsStats.duration : false,
      expiresIn: networkStatsCache.runningAppsStats.time ? Math.max(0, networkStatsCache.runningAppsStats.duration - (now - networkStatsCache.runningAppsStats.time)) : 0
    }
  };
}

// Cleanup function
export function cleanup() {
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
  }
  
  // Stop network stats collection
  stopNetworkStatsCollection();
  
  addressCache.clear();
  blockCache.clear();
  clearNetworkStatsCache();
  console.log('🧹 API module cleanup completed');
}

// NEW: Auto-start network stats collection on module load
console.log('🚀 Starting network stats collection service...');
setTimeout(() => {
  startNetworkStatsCollection();
}, 5000); // Start after 5 seconds to allow system initialization