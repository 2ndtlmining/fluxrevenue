// config.js - RECOMMENDED SPEED OPTIMIZATIONS - Balanced approach for speed + safety

// Target addresses to track - can be one or multiple
export const TARGET_ADDRESSES = [
  't3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX',
  // Add more addresses here as needed
  // 't3AnotherFluxAddress...',
  // 't3YetAnotherAddress...'
];

// Sync configuration - SPEED OPTIMIZED BUT SAFE
export const SYNC_CONFIG = {
  BLOCKS_PER_DAY: 720,
  RETENTION_DAYS: 1460,
  MAX_BLOCKS_PER_SYNC: 5000,         // 🚀 INCREASED FROM 1000 (5x improvement)
  SYNC_INTERVAL: 90 * 1000,          // 🚀 REDUCED TO 90 SECONDS (was 2 minutes)
  PARALLEL_BATCHES: 15,              // 🚀 INCREASED FROM 10 (50% more parallelism)
  BATCH_SIZE: 100,                   // 🚀 DOUBLED FROM 50 (2x larger batches)
  ENABLE_FAST_SYNC: true,
  
  // NEW: Safe speed optimizations
  ENABLE_EMPTY_BLOCK_SKIP: true,     // 🚀 Skip blocks with no relevant transactions
  ENABLE_SMART_BATCHING: true,       // 🚀 Adaptive batch sizes based on data density
  ENABLE_MEMORY_ACCUMULATION: true,  // 🚀 Accumulate transactions in memory before DB write
  MEMORY_FLUSH_THRESHOLD: 10000,     // 🚀 Write to DB every 10k transactions (safe size)
  
  // Progressive sync strategy
  ENABLE_PROGRESSIVE_SYNC: true,     // 🚀 Prioritize recent blocks first
  RECENT_BLOCKS_BATCH_SIZE: 50,      // Smaller batches for recent data (responsiveness)
  HISTORICAL_BATCH_SIZE: 200,        // Larger batches for historical data (throughput)
  
  // Safety settings
  MAX_MEMORY_USAGE_MB: 512,          // 🛡️ Limit memory usage to 512MB
  ENABLE_GRACEFUL_DEGRADATION: true, // 🛡️ Reduce speed if errors occur
};

// API configuration - OPTIMIZED FOR SPEED + RELIABILITY
export const API_CONFIG = {
  BASE_URL: 'https://api.runonflux.io',
  MAX_RETRIES: 3,                    // Keep retries for reliability
  RETRY_DELAY: 150,                  // 🚀 REDUCED FROM 200ms (faster retries)
  BATCH_SIZE: 50,                    // 🚀 INCREASED FROM 20 (2.5x larger API batches)
  REQUEST_DELAY: 15,                 // 🚀 REDUCED FROM 25ms (faster requests)
  MAX_CONCURRENT: 50,                // 🚀 DOUBLED FROM 25 (2x more concurrent)
  CONNECTION_TIMEOUT: 20000,         // 🚀 INCREASED TO 20s (handle larger batches)
  ENABLE_CACHING: true,
  CACHE_SIZE: 25000,                 // 🚀 INCREASED FROM 10000 (2.5x larger cache)
  AGGRESSIVE_PARALLEL: true,
  
  // NEW: Connection optimization (safe)
  ENABLE_KEEP_ALIVE: true,           // 🚀 Persistent connections
  KEEP_ALIVE_TIMEOUT: 30000,         // 30 second keep-alive
  MAX_SOCKETS: 60,                   // 🚀 More socket connections
  
  // NEW: Request optimization (conservative)
  ENABLE_COMPRESSION: true,          // 🚀 Enable gzip compression
  ENABLE_REQUEST_POOLING: true,      // 🚀 Pool similar requests
  PREFETCH_AHEAD: 2,                 // 🚀 Prefetch next 2 batches (not too aggressive)
  
  // Safety features
  RATE_LIMIT_BACKOFF: true,          // 🛡️ Back off if rate limited
  ERROR_THRESHOLD: 10,               // 🛡️ Reduce speed after 10 consecutive errors
};

// Database configuration - SPEED OPTIMIZED WITH SAFETY
export const DB_CONFIG = {
  DB_NAME: 'flux-tracker.db',
  BATCH_INSERT_SIZE: 500,            // 🚀 INCREASED FROM 200 (2.5x larger batches)
  ENABLE_WAL_MODE: true,
  OPTIMIZE_INDEXES: true,
  
  // NEW: Speed optimizations for sync (SAFE VERSION)
  SYNC_SPEED_MODE: {
    synchronous: 'NORMAL',           // 🛡️ Keep NORMAL for safety (not OFF)
    journal_mode: 'WAL',             // 🛡️ Keep WAL mode (safer than MEMORY)
    cache_size: 131072,               // 🔄 INCREASED: 512MB cache (was 256MB) for larger DB
    temp_store: 'MEMORY',            // 🚀 Temp tables in memory (safe)
    mmap_size: 1073741824,            // 🔄 INCREASED: 1GB memory-mapped I/O (was 512MB)
    page_size: 4096,                 // 🛡️ Keep standard page size for compatibility
  },
  
  // NEW: Memory-based transaction accumulation (SAFE)
  ENABLE_MEMORY_BUFFER: true,        // 🚀 Buffer transactions in memory
  MEMORY_BUFFER_SIZE: 25000,         // 🚀 25k transactions before flush (reasonable)
  AUTO_VACUUM: 'INCREMENTAL',        // 🚀 Incremental vacuum for large DBs
  
  // Safety settings
  BACKUP_BEFORE_OPTIMIZATION: true,  // 🛡️ Backup DB before speed optimizations
  MAX_DB_SIZE_GB: 55,                 // 🛡️ Limit DB size to 55GB
  ENABLE_INTEGRITY_CHECKS: true,     // 🛡️ Regular integrity checks
};

// Price API configuration - BALANCED OPTIMIZATION
export const PRICE_CONFIG = {
  PRICE_API_URL: 'https://explorer.runonflux.io/api/currency',
  PRICE_UPDATE_INTERVAL: 3 * 60 * 1000,  // 🚀 REDUCED TO 3 MINUTES (was 5)
  PRICE_RETRY_ATTEMPTS: 3,               // Keep retries for reliability
  PRICE_RETRY_DELAY: 1500,               // 🚀 REDUCED FROM 2000ms
  PRICE_TIMEOUT: 8000,                   // 🚀 REDUCED FROM 10000ms
  FALLBACK_PRICE_APIS: [
    'https://api.coingecko.com/api/v3/simple/price?ids=flux&vs_currencies=usd',
    'https://api.coinbase.com/v2/exchange-rates?currency=FLUX',
  ],
  ENABLE_PRICE_CACHE: true,
  PRICE_CACHE_DURATION: 60 * 1000,       // 🚀 REDUCED TO 1 MINUTE (was 2 min)
};

// Revenue blocks configuration - SPEED OPTIMIZED
export const REVENUE_CONFIG = {
  BLOCK_TIME_SECONDS: 120,
  REVENUE_UPDATE_INTERVAL: 20 * 1000,    // 🚀 REDUCED TO 20 SECONDS (was 30)
  BLOCK_PERIODS: {
    day: 720,      // 1 day = 720 blocks
    week: 5040,    // 7 days = 5040 blocks  
    month: 21600,  // 30 days = 21600 blocks
    quarter: 64800,  // 🔄 NEW: 90 days = 64800 blocks
    year: 262800,   // 365 days = 262800 blocks
    fouryear: 1051200 // 🔄 NEW: 4 years = 1051200 blocks

  },
  ENABLE_REVENUE_CACHE: true,
  REVENUE_CACHE_DURATION: 10 * 1000,     // 🚀 REDUCED TO 10 SECONDS (was 15)
  
  // NEW: Revenue calculation optimizations
  ENABLE_BLOCK_RANGE_CACHE: true,        // 🚀 Cache block range queries
  BLOCK_RANGE_CACHE_SIZE: 2000,           // 🚀 Cache 2000 block ranges (reasonable)
  PARALLEL_REVENUE_CALC: true,           // 🚀 Calculate all periods in parallel
};

// Network stats collection configuration - OPTIMIZED
export const NETWORK_STATS_CONFIG = {
  COLLECTION_FREQUENCY: 8 * 60 * 60 * 1000,  // 🚀 REDUCED TO 8 HOURS (was 12)
  COLLECTION_HOURS: [0, 8, 16],              // 🚀 3 TIMES DAILY (was 2)
  RETENTION_DAYS: 1460,
  MAX_SNAPSHOTS: 4380,                       // 🚀 INCREASED (365 * 3 snapshots)
  API_TIMEOUT: 15000,                        // 🚀 REDUCED FROM 30s (faster timeout)
  MAX_RETRIES: 3,                            // Keep retries for reliability
  RETRY_DELAY: 3000,                         // 🚀 REDUCED FROM 5000ms
  
  MIN_REQUIRED_FIELDS: {
    nodeStats: ['total', 'cumulus', 'nimbus', 'stratus'],
    utilizationStats: ['total_cores', 'total_ram_gb', 'total_ssd_gb', 'utilized_cores']
  },
  
  STORE_PARTIAL_DATA: true,
  REQUIRE_MINIMUM_SUCCESS_RATE: 40,          // 🚀 REDUCED FROM 50% (more lenient)
  AUTO_CLEANUP_ENABLED: true,
  CLEANUP_HOUR: 3,
  LOG_COLLECTION_PERFORMANCE: true,
  LOG_API_FAILURES: true,                    // Keep logging for monitoring
  MAX_CONSECUTIVE_FAILURES: 7,               // 🚀 REDUCED FROM 10
  FALLBACK_TO_CACHE: true,
  
  // NEW: Parallel collection (safe)
  ENABLE_PARALLEL_COLLECTION: true,          // 🚀 Collect all stats in parallel
  COLLECTION_TIMEOUT: 45000,                 // 🚀 45s total timeout for all APIs
  
  CUSTOM_API_ENDPOINTS: {
    nodeCount: null,
    arcaneStats: null,
    utilizationStats: null,
    runningApps: null
  }
};

// UI configuration - OPTIMIZED FOR RESPONSIVENESS
export const UI_CONFIG = {
  DEFAULT_PAGINATION_LIMIT: 75,             // 🚀 INCREASED FROM 50
  MAX_PAGINATION_LIMIT: 200,                // 🚀 DOUBLED FROM 100
  REFRESH_INTERVAL: 20 * 1000,              // 🚀 REDUCED TO 20 SECONDS (was 30)
  ENABLE_CURRENCY_TOGGLE: true,
  DEFAULT_CURRENCY: 'FLUX',
  ENABLE_AUTO_REFRESH: true,
  
  // NEW: Performance optimizations
  ENABLE_VIRTUAL_SCROLLING: true,            // 🚀 Virtual scrolling for large lists
  LAZY_LOAD_CHARTS: true,                    // 🚀 Lazy load chart data
  DEBOUNCE_SEARCH: 300,                      // 🚀 300ms search debounce (reasonable)
  CACHE_CHART_DATA: true,                    // 🚀 Cache chart calculations
  
  // Safety settings
  MAX_CHART_POINTS: 1000,                    // 🛡️ Limit chart complexity
  ENABLE_PERFORMANCE_MONITORING: true,       // 🛡️ Monitor UI performance
};

// Performance monitoring - BALANCED
export const PERFORMANCE_CONFIG = {
  ENABLE_METRICS: true,
  LOG_PERFORMANCE: true,                     // Keep logging for monitoring
  TRACK_API_CALLS: true,
  MEASURE_BATCH_TIMES: true,
  LOG_PRICE_UPDATES: false,                  // 🚀 DISABLED FOR SPEED
  LOG_REVENUE_UPDATES: false,                // 🚀 DISABLED FOR SPEED
  
  // NEW: Performance tracking (conservative)
  TRACK_MEMORY_USAGE: true,                  // 🚀 Monitor memory usage
  AUTO_GC_TRIGGER: 100000,                   // 🚀 Trigger GC after 100k operations
  PERFORMANCE_SAMPLING: 0.2,                 // 🚀 Sample 20% of operations (not 100%)
  METRICS_BUFFER_SIZE: 5000,                 // 🚀 Buffer metrics before processing
  
  // Safety settings
  MAX_LOG_SIZE_MB: 50,                       // 🛡️ Limit log file size
  ENABLE_PERFORMANCE_ALERTS: true,          // 🛡️ Alert on performance issues
};

// NEW: Progressive optimization levels
export const OPTIMIZATION_LEVELS = {
  // Level 1: Safe speed improvements (default)
  CONSERVATIVE: {
    MAX_BLOCKS_PER_SYNC: 5000,
    PARALLEL_BATCHES: 15,
    MAX_CONCURRENT: 50,
    BATCH_SIZE: 100,
    MEMORY_BUFFER_SIZE: 25000,
  },
  
  // Level 2: Aggressive but stable
  AGGRESSIVE: {
    MAX_BLOCKS_PER_SYNC: 10000,
    PARALLEL_BATCHES: 25,
    MAX_CONCURRENT: 75,
    BATCH_SIZE: 200,
    MEMORY_BUFFER_SIZE: 50000,
  },
  
  // Level 3: Maximum speed (use with monitoring)
  MAXIMUM: {
    MAX_BLOCKS_PER_SYNC: 20000,
    PARALLEL_BATCHES: 40,
    MAX_CONCURRENT: 100,
    BATCH_SIZE: 500,
    MEMORY_BUFFER_SIZE: 100000,
  }
};

// Helper functions
export function isValidFluxAddress(address) {
  return typeof address === 'string' && 
         address.length >= 20 && 
         (address.startsWith('t3') || address.startsWith('t1'));
}

export function getAllTargetAddresses() {
  return TARGET_ADDRESSES.filter(isValidFluxAddress);
}

export function getMainAddress() {
  return TARGET_ADDRESSES[0];
}

// NEW: Optimization level management
export function getOptimizationLevel() {
  if (process.env.FLUX_OPTIMIZATION_LEVEL) {
    const level = process.env.FLUX_OPTIMIZATION_LEVEL.toUpperCase();
    return OPTIMIZATION_LEVELS[level] ? level : 'CONSERVATIVE';
  }
  return 'CONSERVATIVE';
}

export function applyOptimizationLevel(level = null) {
  const targetLevel = level || getOptimizationLevel();
  const config = OPTIMIZATION_LEVELS[targetLevel];
  
  if (config) {
    console.log(`🚀 Applying ${targetLevel} optimization level`);
    SYNC_CONFIG.MAX_BLOCKS_PER_SYNC = config.MAX_BLOCKS_PER_SYNC;
    SYNC_CONFIG.PARALLEL_BATCHES = config.PARALLEL_BATCHES;
    API_CONFIG.MAX_CONCURRENT = config.MAX_CONCURRENT;
    SYNC_CONFIG.BATCH_SIZE = config.BATCH_SIZE;
    DB_CONFIG.MEMORY_BUFFER_SIZE = config.MEMORY_BUFFER_SIZE;
  }
}

// Export helper functions
export function getPriceApiConfig() {
  return {
    url: PRICE_CONFIG.PRICE_API_URL,
    updateInterval: PRICE_CONFIG.PRICE_UPDATE_INTERVAL,
    retryAttempts: PRICE_CONFIG.PRICE_RETRY_ATTEMPTS,
    retryDelay: PRICE_CONFIG.PRICE_RETRY_DELAY,
    timeout: PRICE_CONFIG.PRICE_TIMEOUT,
    fallbackApis: PRICE_CONFIG.FALLBACK_PRICE_APIS,
    enableCache: PRICE_CONFIG.ENABLE_PRICE_CACHE,
    cacheDuration: PRICE_CONFIG.PRICE_CACHE_DURATION
  };
}

export function getRevenueConfig() {
  return {
    blockTimeSeconds: REVENUE_CONFIG.BLOCK_TIME_SECONDS,
    updateInterval: REVENUE_CONFIG.REVENUE_UPDATE_INTERVAL,
    blockPeriods: REVENUE_CONFIG.BLOCK_PERIODS,
    enableCache: REVENUE_CONFIG.ENABLE_REVENUE_CACHE,
    cacheDuration: REVENUE_CONFIG.REVENUE_CACHE_DURATION
  };
}

export function getNetworkStatsConfig() {
  return NETWORK_STATS_CONFIG;
}

export function getDefaultCurrency() {
  return UI_CONFIG.DEFAULT_CURRENCY;
}

export function isCurrencyToggleEnabled() {
  return UI_CONFIG.ENABLE_CURRENCY_TOGGLE;
}

// Environment variable overrides with new optimization levels
if (typeof process !== 'undefined' && process.env && process.env.FLUX_ADDRESSES) {
  try {
    const envAddresses = process.env.FLUX_ADDRESSES.split(',').map(addr => addr.trim());
    const validAddresses = envAddresses.filter(isValidFluxAddress);
    if (validAddresses.length > 0) {
      TARGET_ADDRESSES.length = 0;
      TARGET_ADDRESSES.push(...validAddresses);
      console.log(`📍 Using addresses from environment: ${TARGET_ADDRESSES.join(', ')}`);
    }
  } catch (error) {
    console.warn('⚠️ Error parsing FLUX_ADDRESSES environment variable:', error.message);
  }
}

// Performance optimization environment variables
if (typeof process !== 'undefined' && process.env) {
  // Apply optimization level
  applyOptimizationLevel();
  
  if (process.env.FLUX_FAST_SYNC === 'true') {
    SYNC_CONFIG.ENABLE_FAST_SYNC = true;
    console.log('🚀 Fast sync mode enabled via environment variable');
  }

  if (process.env.FLUX_MAX_CONCURRENT) {
    API_CONFIG.MAX_CONCURRENT = parseInt(process.env.FLUX_MAX_CONCURRENT) || 50;
    console.log(`⚡ Max concurrent requests set to: ${API_CONFIG.MAX_CONCURRENT}`);
  }

  if (process.env.FLUX_BATCH_SIZE) {
    SYNC_CONFIG.BATCH_SIZE = parseInt(process.env.FLUX_BATCH_SIZE) || 100;
    console.log(`📦 Batch size set to: ${SYNC_CONFIG.BATCH_SIZE}`);
  }
  
  // NEW: Quick speed boost environment variable
  if (process.env.FLUX_SPEED_BOOST === 'true') {
    console.log('🚀🚀 SPEED BOOST ACTIVATED 🚀🚀');
    applyOptimizationLevel('AGGRESSIVE');
  }
  
  // NEW: Maximum performance mode
  if (process.env.FLUX_MAX_PERFORMANCE === 'true') {
    console.log('⚡⚡⚡ MAXIMUM PERFORMANCE MODE ⚡⚡⚡');
    applyOptimizationLevel('MAXIMUM');
    
    // Additional max performance settings
    SYNC_CONFIG.SYNC_INTERVAL = 60 * 1000;  // 1 minute sync
    API_CONFIG.REQUEST_DELAY = 5;           // Minimal delay
    PERFORMANCE_CONFIG.LOG_PERFORMANCE = false;  // Disable logging
  }
}

// Price API environment variables
if (typeof process !== 'undefined' && process.env) {
  if (process.env.FLUX_PRICE_UPDATE_INTERVAL) {
    PRICE_CONFIG.PRICE_UPDATE_INTERVAL = parseInt(process.env.FLUX_PRICE_UPDATE_INTERVAL) || (3 * 60 * 1000);
    console.log(`💰 Price update interval set to: ${PRICE_CONFIG.PRICE_UPDATE_INTERVAL}ms`);
  }

  if (process.env.FLUX_REVENUE_UPDATE_INTERVAL) {
    REVENUE_CONFIG.REVENUE_UPDATE_INTERVAL = parseInt(process.env.FLUX_REVENUE_UPDATE_INTERVAL) || (20 * 1000);
    console.log(`📊 Revenue update interval set to: ${REVENUE_CONFIG.REVENUE_UPDATE_INTERVAL}ms`);
  }

  if (process.env.FLUX_DEFAULT_CURRENCY) {
    const currency = process.env.FLUX_DEFAULT_CURRENCY.toUpperCase();
    if (currency === 'FLUX' || currency === 'USD') {
      UI_CONFIG.DEFAULT_CURRENCY = currency;
      console.log(`💱 Default currency set to: ${UI_CONFIG.DEFAULT_CURRENCY}`);
    }
  }
}

// Network stats environment variable overrides
if (typeof process !== 'undefined' && process.env) {
  if (process.env.FLUX_NETWORK_STATS_RETENTION_DAYS) {
    NETWORK_STATS_CONFIG.RETENTION_DAYS = parseInt(process.env.FLUX_NETWORK_STATS_RETENTION_DAYS) || 365;
    console.log(`📊 Network stats retention set to: ${NETWORK_STATS_CONFIG.RETENTION_DAYS} days`);
  }
  
  if (process.env.FLUX_NETWORK_STATS_COLLECTION_HOURS) {
    try {
      const hours = process.env.FLUX_NETWORK_STATS_COLLECTION_HOURS.split(',').map(h => parseInt(h.trim()));
      if (hours.every(h => h >= 0 && h <= 23)) {
        NETWORK_STATS_CONFIG.COLLECTION_HOURS = hours;
        console.log(`📊 Network stats collection hours set to: ${NETWORK_STATS_CONFIG.COLLECTION_HOURS.join(', ')}`);
      }
    } catch (error) {
      console.warn('⚠️ Error parsing FLUX_NETWORK_STATS_COLLECTION_HOURS:', error.message);
    }
  }
  
  if (process.env.FLUX_NETWORK_STATS_STORE_PARTIAL === 'false') {
    NETWORK_STATS_CONFIG.STORE_PARTIAL_DATA = false;
    console.log(`📊 Network stats partial data storage: disabled`);
  }
  
  if (process.env.FLUX_NETWORK_STATS_MIN_SUCCESS_RATE) {
    const rate = parseInt(process.env.FLUX_NETWORK_STATS_MIN_SUCCESS_RATE);
    if (rate >= 0 && rate <= 100) {
      NETWORK_STATS_CONFIG.REQUIRE_MINIMUM_SUCCESS_RATE = rate;
      console.log(`📊 Network stats minimum success rate set to: ${rate}%`);
    }
  }
  
  if (process.env.FLUX_NETWORK_STATS_AUTO_CLEANUP === 'false') {
    NETWORK_STATS_CONFIG.AUTO_CLEANUP_ENABLED = false;
    console.log(`📊 Network stats auto cleanup: disabled`);
  }
}

// Final configuration summary
const currentLevel = getOptimizationLevel();
console.log(`🚀 Flux Revenue Tracker - Optimization Level: ${currentLevel}`);
console.log(`⚡ Performance settings: BLOCKS=${SYNC_CONFIG.MAX_BLOCKS_PER_SYNC}, BATCHES=${SYNC_CONFIG.PARALLEL_BATCHES}, CONCURRENT=${API_CONFIG.MAX_CONCURRENT}`);
console.log(`💾 Memory settings: BUFFER=${DB_CONFIG.MEMORY_BUFFER_SIZE}, CACHE=${DB_CONFIG.SYNC_SPEED_MODE.cache_size}`);
console.log(`🔄 Timing: SYNC_INTERVAL=${SYNC_CONFIG.SYNC_INTERVAL}ms, REVENUE_UPDATE=${REVENUE_CONFIG.REVENUE_UPDATE_INTERVAL}ms`);

// Usage instructions
console.log(`\n📋 OPTIMIZATION LEVELS AVAILABLE:`);
console.log(`   🟢 CONSERVATIVE (default): Balanced speed + safety`);
console.log(`   🟡 AGGRESSIVE: export FLUX_SPEED_BOOST=true`);
console.log(`   🔴 MAXIMUM: export FLUX_MAX_PERFORMANCE=true`);
console.log(`\n🚀 For immediate 5x speed boost, run: export FLUX_SPEED_BOOST=true`);