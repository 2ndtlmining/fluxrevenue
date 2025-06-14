// config.js - Centralized configuration for the Flux tracker - OPTIMIZED + NETWORK STATS

// Target addresses to track - can be one or multiple
export const TARGET_ADDRESSES = [
  't3NryfAQLGeFs9jEoeqsxmBN2QLRaRKFLUX',
  // Add more addresses here as needed
  // 't3AnotherFluxAddress...',
  // 't3YetAnotherAddress...'
];

// Sync configuration - OPTIMIZED FOR SPEED
export const SYNC_CONFIG = {
  BLOCKS_PER_DAY: 720,
  RETENTION_DAYS: 365,
  MAX_BLOCKS_PER_SYNC: 1000, // Increased from 200
  SYNC_INTERVAL: 2 * 60 * 1000, // Reduced to 2 minutes from 5
  PARALLEL_BATCHES: 10, // NEW: Number of parallel batches
  BATCH_SIZE: 50, // NEW: Blocks per batch
  ENABLE_FAST_SYNC: true, // NEW: Enable all optimizations
};

// API configuration - OPTIMIZED FOR SPEED
export const API_CONFIG = {
  BASE_URL: 'https://api.runonflux.io',
  MAX_RETRIES: 3,
  RETRY_DELAY: 200, // Reduced from 1000ms
  BATCH_SIZE: 20, // Increased from 5
  REQUEST_DELAY: 25, // Reduced from 100ms
  MAX_CONCURRENT: 25, // NEW: Maximum concurrent requests
  CONNECTION_TIMEOUT: 15000, // NEW: 15 second timeout
  ENABLE_CACHING: true, // NEW: Enable address caching
  CACHE_SIZE: 10000, // NEW: Cache size for resolved addresses
  AGGRESSIVE_PARALLEL: true, // NEW: Enable aggressive parallelization
};

// Price API configuration - NEW
export const PRICE_CONFIG = {
  PRICE_API_URL: 'https://explorer.runonflux.io/api/currency',
  PRICE_UPDATE_INTERVAL: 5 * 60 * 1000, // 5 minutes
  PRICE_RETRY_ATTEMPTS: 3,
  PRICE_RETRY_DELAY: 2000, // 2 seconds
  PRICE_TIMEOUT: 10000, // 10 seconds
  FALLBACK_PRICE_APIS: [
    'https://api.coingecko.com/api/v3/simple/price?ids=flux&vs_currencies=usd',
    // Add other fallback APIs if needed
  ],
  ENABLE_PRICE_CACHE: true,
  PRICE_CACHE_DURATION: 2 * 60 * 1000, // 2 minutes cache
};

// Revenue blocks configuration - NEW
export const REVENUE_CONFIG = {
  BLOCK_TIME_SECONDS: 120, // 2 minutes per block (Flux standard)
  REVENUE_UPDATE_INTERVAL: 30 * 1000, // 30 seconds
  BLOCK_PERIODS: {
    day: 720,      // 1 day = 720 blocks
    week: 5040,    // 7 days = 5040 blocks  
    month: 21600,  // 30 days = 21600 blocks
    year: 262800   // 365 days = 262800 blocks
  },
  ENABLE_REVENUE_CACHE: true,
  REVENUE_CACHE_DURATION: 15 * 1000, // 15 seconds cache
};

// NEW: Network stats collection configuration
export const NETWORK_STATS_CONFIG = {
  // Collection schedule - twice daily (every 12 hours)
  COLLECTION_FREQUENCY: 12 * 60 * 60 * 1000, // 12 hours in milliseconds
  COLLECTION_HOURS: [0, 12], // UTC hours to collect (00:00 and 12:00)
  
  // Data retention
  RETENTION_DAYS: 365, // Keep 1 year of data
  MAX_SNAPSHOTS: 730, // 365 days * 2 snapshots per day
  
  // Collection timeouts and retries
  API_TIMEOUT: 30000, // 30 seconds timeout for each API call
  MAX_RETRIES: 3,
  RETRY_DELAY: 5000, // 5 seconds between retries
  
  // Data validation
  MIN_REQUIRED_FIELDS: {
    nodeStats: ['total', 'cumulus', 'nimbus', 'stratus'],
    utilizationStats: ['total_cores', 'total_ram_gb', 'total_ssd_gb', 'utilized_cores']
  },
  
  // Storage strategy
  STORE_PARTIAL_DATA: true, // Store data even if some APIs fail
  REQUIRE_MINIMUM_SUCCESS_RATE: 50, // Minimum 50% API success rate to store
  
  // Cleanup settings
  AUTO_CLEANUP_ENABLED: true,
  CLEANUP_HOUR: 3, // 3 AM UTC daily cleanup
  
  // Performance monitoring
  LOG_COLLECTION_PERFORMANCE: true,
  LOG_API_FAILURES: true,
  
  // Emergency settings
  MAX_CONSECUTIVE_FAILURES: 10, // Stop trying after 10 failures
  FALLBACK_TO_CACHE: true, // Use cached data if APIs fail
  
  // API endpoints override (if needed)
  CUSTOM_API_ENDPOINTS: {
    nodeCount: null, // Use default
    arcaneStats: null, // Use default
    utilizationStats: null, // Use default
    runningApps: null // Use default
  }
};

// Database configuration - OPTIMIZED
export const DB_CONFIG = {
  DB_NAME: 'flux-tracker.db',
  BATCH_INSERT_SIZE: 200, // NEW: Batch insert size
  ENABLE_WAL_MODE: true, // NEW: Enable WAL mode for better concurrency
  OPTIMIZE_INDEXES: true, // NEW: Enable index optimizations
};

// UI configuration
export const UI_CONFIG = {
  DEFAULT_PAGINATION_LIMIT: 50,
  MAX_PAGINATION_LIMIT: 100,
  REFRESH_INTERVAL: 30 * 1000, // 30 seconds
  ENABLE_CURRENCY_TOGGLE: true, // Enable FLUX/USD toggle
  DEFAULT_CURRENCY: 'FLUX', // 'FLUX' or 'USD'
  ENABLE_AUTO_REFRESH: true,
};

// Performance monitoring - NEW
export const PERFORMANCE_CONFIG = {
  ENABLE_METRICS: true,
  LOG_PERFORMANCE: true,
  TRACK_API_CALLS: true,
  MEASURE_BATCH_TIMES: true,
  LOG_PRICE_UPDATES: true, // NEW: Log price API calls
  LOG_REVENUE_UPDATES: true, // NEW: Log revenue API calls
};

// Helper functions
export function isValidFluxAddress(address) {
  // Basic validation for Flux addresses (they start with 't3' for transparent addresses)
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

// Price API helper functions - NEW
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

// Revenue API helper functions - NEW
export function getRevenueConfig() {
  return {
    blockTimeSeconds: REVENUE_CONFIG.BLOCK_TIME_SECONDS,
    updateInterval: REVENUE_CONFIG.REVENUE_UPDATE_INTERVAL,
    blockPeriods: REVENUE_CONFIG.BLOCK_PERIODS,
    enableCache: REVENUE_CONFIG.ENABLE_REVENUE_CACHE,
    cacheDuration: REVENUE_CONFIG.REVENUE_CACHE_DURATION
  };
}

// NEW: Network stats helper functions
export function getNetworkStatsConfig() {
  return {
    collectionFrequency: NETWORK_STATS_CONFIG.COLLECTION_FREQUENCY,
    collectionHours: NETWORK_STATS_CONFIG.COLLECTION_HOURS,
    retentionDays: NETWORK_STATS_CONFIG.RETENTION_DAYS,
    maxSnapshots: NETWORK_STATS_CONFIG.MAX_SNAPSHOTS,
    apiTimeout: NETWORK_STATS_CONFIG.API_TIMEOUT,
    maxRetries: NETWORK_STATS_CONFIG.MAX_RETRIES,
    retryDelay: NETWORK_STATS_CONFIG.RETRY_DELAY,
    minRequiredFields: NETWORK_STATS_CONFIG.MIN_REQUIRED_FIELDS,
    storePartialData: NETWORK_STATS_CONFIG.STORE_PARTIAL_DATA,
    requireMinimumSuccessRate: NETWORK_STATS_CONFIG.REQUIRE_MINIMUM_SUCCESS_RATE,
    autoCleanupEnabled: NETWORK_STATS_CONFIG.AUTO_CLEANUP_ENABLED,
    cleanupHour: NETWORK_STATS_CONFIG.CLEANUP_HOUR,
    logCollectionPerformance: NETWORK_STATS_CONFIG.LOG_COLLECTION_PERFORMANCE,
    logApiFailures: NETWORK_STATS_CONFIG.LOG_API_FAILURES,
    maxConsecutiveFailures: NETWORK_STATS_CONFIG.MAX_CONSECUTIVE_FAILURES,
    fallbackToCache: NETWORK_STATS_CONFIG.FALLBACK_TO_CACHE,
    customApiEndpoints: NETWORK_STATS_CONFIG.CUSTOM_API_ENDPOINTS
  };
}

// Currency formatting helper - NEW
export function getDefaultCurrency() {
  return UI_CONFIG.DEFAULT_CURRENCY;
}

export function isCurrencyToggleEnabled() {
  return UI_CONFIG.ENABLE_CURRENCY_TOGGLE;
}

// Environment variable override
if (typeof process !== 'undefined' && process.env && process.env.FLUX_ADDRESSES) {
  try {
    const envAddresses = process.env.FLUX_ADDRESSES.split(',').map(addr => addr.trim());
    const validAddresses = envAddresses.filter(isValidFluxAddress);
    if (validAddresses.length > 0) {
      TARGET_ADDRESSES.length = 0; // Clear existing
      TARGET_ADDRESSES.push(...validAddresses);
      console.log(`📍 Using addresses from environment: ${TARGET_ADDRESSES.join(', ')}`);
    }
  } catch (error) {
    console.warn('⚠️ Error parsing FLUX_ADDRESSES environment variable:', error.message);
  }
}

// Performance optimization environment variables
if (typeof process !== 'undefined' && process.env && process.env.FLUX_FAST_SYNC === 'true') {
  SYNC_CONFIG.ENABLE_FAST_SYNC = true;
  console.log('🚀 Fast sync mode enabled via environment variable');
}

if (typeof process !== 'undefined' && process.env && process.env.FLUX_MAX_CONCURRENT) {
  API_CONFIG.MAX_CONCURRENT = parseInt(process.env.FLUX_MAX_CONCURRENT) || 25;
  console.log(`⚡ Max concurrent requests set to: ${API_CONFIG.MAX_CONCURRENT}`);
}

if (typeof process !== 'undefined' && process.env && process.env.FLUX_BATCH_SIZE) {
  SYNC_CONFIG.BATCH_SIZE = parseInt(process.env.FLUX_BATCH_SIZE) || 50;
  console.log(`📦 Batch size set to: ${SYNC_CONFIG.BATCH_SIZE}`);
}

// Price API environment variables - NEW
if (typeof process !== 'undefined' && process.env && process.env.FLUX_PRICE_UPDATE_INTERVAL) {
  PRICE_CONFIG.PRICE_UPDATE_INTERVAL = parseInt(process.env.FLUX_PRICE_UPDATE_INTERVAL) || (5 * 60 * 1000);
  console.log(`💰 Price update interval set to: ${PRICE_CONFIG.PRICE_UPDATE_INTERVAL}ms`);
}

if (typeof process !== 'undefined' && process.env && process.env.FLUX_REVENUE_UPDATE_INTERVAL) {
  REVENUE_CONFIG.REVENUE_UPDATE_INTERVAL = parseInt(process.env.FLUX_REVENUE_UPDATE_INTERVAL) || (30 * 1000);
  console.log(`📊 Revenue update interval set to: ${REVENUE_CONFIG.REVENUE_UPDATE_INTERVAL}ms`);
}

if (typeof process !== 'undefined' && process.env && process.env.FLUX_DEFAULT_CURRENCY) {
  const currency = process.env.FLUX_DEFAULT_CURRENCY.toUpperCase();
  if (currency === 'FLUX' || currency === 'USD') {
    UI_CONFIG.DEFAULT_CURRENCY = currency;
    console.log(`💱 Default currency set to: ${UI_CONFIG.DEFAULT_CURRENCY}`);
  }
}

// NEW: Network stats environment variable overrides
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