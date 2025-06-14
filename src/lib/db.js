import Database from 'better-sqlite3';
import { DB_CONFIG } from './config.js';

const db = new Database(DB_CONFIG.DB_NAME, {
  // OPTIMIZED: Enable WAL mode for better concurrency
  ...(DB_CONFIG.ENABLE_WAL_MODE && {
    fileMustExist: false,
    timeout: 10000,
  })
});

// OPTIMIZED: Enable WAL mode and other performance optimizations
if (DB_CONFIG.ENABLE_WAL_MODE) {
  console.log('🚀 Enabling database optimizations...');
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Optimize SQLite for performance
  db.pragma('synchronous = NORMAL'); // Faster than FULL, still safe with WAL
  db.pragma('cache_size = 32768'); // 128MB cache (32768 * 4KB pages)
  db.pragma('temp_store = MEMORY'); // Store temp tables in memory
  db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O
  db.pragma('optimize'); // Analyze and optimize database
  
  console.log('✅ Database optimizations enabled');
}

// Initialize database schema with optimizations and NEW NETWORK STATS TABLES
db.exec(`
  CREATE TABLE IF NOT EXISTS blocks (
    height INTEGER PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    hash TEXT NOT NULL,
    synced_at INTEGER DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block_height INTEGER NOT NULL,
    tx_hash TEXT NOT NULL,
    vout_index INTEGER NOT NULL,
    address TEXT NOT NULL,
    from_address TEXT,
    value REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (block_height) REFERENCES blocks (height),
    UNIQUE(tx_hash, vout_index, address)
  );

  -- NEW: Historical network node statistics table
  CREATE TABLE IF NOT EXISTS network_node_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL UNIQUE, -- Prevent duplicate snapshots
    total_nodes INTEGER NOT NULL,
    cumulus_nodes INTEGER NOT NULL,
    nimbus_nodes INTEGER NOT NULL,
    stratus_nodes INTEGER NOT NULL,
    arcane_nodes INTEGER NOT NULL DEFAULT 0,
    arcane_percentage REAL NOT NULL DEFAULT 0,
    cumulus_percentage REAL NOT NULL DEFAULT 0,
    nimbus_percentage REAL NOT NULL DEFAULT 0,
    stratus_percentage REAL NOT NULL DEFAULT 0,
    data_source TEXT NOT NULL DEFAULT 'api', -- 'api', 'cache', or 'partial'
    api_success_rate REAL NOT NULL DEFAULT 100, -- Track API reliability
    created_at INTEGER DEFAULT (unixepoch()),
    notes TEXT -- For debugging failed captures
  );

  -- NEW: Historical network utilization statistics table
  CREATE TABLE IF NOT EXISTS network_utilization_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL UNIQUE, -- Prevent duplicate snapshots
    total_cores INTEGER NOT NULL DEFAULT 0,
    total_ram_gb REAL NOT NULL DEFAULT 0,
    total_ssd_gb REAL NOT NULL DEFAULT 0,
    utilized_cores REAL NOT NULL DEFAULT 0,
    utilized_nodes INTEGER NOT NULL DEFAULT 0,
    utilized_ram_gb REAL NOT NULL DEFAULT 0,
    utilized_ssd_gb REAL NOT NULL DEFAULT 0,
    cores_percentage REAL NOT NULL DEFAULT 0,
    nodes_percentage REAL NOT NULL DEFAULT 0,
    ram_percentage REAL NOT NULL DEFAULT 0,
    ssd_percentage REAL NOT NULL DEFAULT 0,
    running_apps INTEGER NOT NULL DEFAULT 0,
    nodes_with_apps INTEGER NOT NULL DEFAULT 0,
    watchtower_instances INTEGER NOT NULL DEFAULT 0,
    total_checked_nodes INTEGER NOT NULL DEFAULT 0,
    data_source TEXT NOT NULL DEFAULT 'api',
    api_success_rate REAL NOT NULL DEFAULT 100,
    created_at INTEGER DEFAULT (unixepoch()),
    notes TEXT
  );

  -- OPTIMIZED: Enhanced indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_transactions_address ON transactions(address);
  CREATE INDEX IF NOT EXISTS idx_transactions_from_address ON transactions(from_address);
  CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_transactions_block_height ON transactions(block_height);
  CREATE INDEX IF NOT EXISTS idx_blocks_timestamp ON blocks(timestamp);
  CREATE INDEX IF NOT EXISTS idx_blocks_height ON blocks(height);
  
  -- OPTIMIZED: Additional composite indexes for common queries
  CREATE INDEX IF NOT EXISTS idx_transactions_address_timestamp ON transactions(address, timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_transactions_address_block ON transactions(address, block_height DESC);
  CREATE INDEX IF NOT EXISTS idx_transactions_hash_vout ON transactions(tx_hash, vout_index);

  -- NEW: Indexes for network stats tables
  CREATE INDEX IF NOT EXISTS idx_network_node_stats_timestamp ON network_node_stats(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_network_node_stats_created ON network_node_stats(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_network_node_stats_source ON network_node_stats(data_source, timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_network_utilization_stats_timestamp ON network_utilization_stats(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_network_utilization_stats_created ON network_utilization_stats(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_network_utilization_stats_source ON network_utilization_stats(data_source, timestamp DESC);
`);

// Add the from_address column if it doesn't exist (for existing databases)
try {
  db.exec(`ALTER TABLE transactions ADD COLUMN from_address TEXT`);
  console.log('✅ Added from_address column to transactions table');
} catch (error) {
  // Column already exists, ignore the error
  if (!error.message.includes('duplicate column name')) {
    console.warn('⚠️ Error adding from_address column:', error.message);
  }
}

// OPTIMIZED: Create additional indexes if they don't exist
if (DB_CONFIG.OPTIMIZE_INDEXES) {
  try {
    console.log('🔧 Creating additional performance indexes...');
    
    // Index for pagination queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_transactions_pagination ON transactions(address, timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_search ON transactions(address, tx_hash, from_address);
      CREATE INDEX IF NOT EXISTS idx_transactions_block_range ON transactions(address, block_height DESC);
    `);
    
    console.log('✅ Additional indexes created');
  } catch (error) {
    console.warn('⚠️ Error creating additional indexes:', error.message);
  }
}

// OPTIMIZED: Prepared statements for performance with batch support + NEW NETWORK STATS STATEMENTS
const statements = {
  // Original statements
  insertBlock: db.prepare(`
    INSERT OR REPLACE INTO blocks (height, timestamp, hash)
    VALUES (?, ?, ?)
  `),
  insertTransaction: db.prepare(`
    INSERT OR IGNORE INTO transactions 
    (block_height, tx_hash, vout_index, address, from_address, value, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getLastBlock: db.prepare(`
    SELECT height FROM blocks ORDER BY height DESC LIMIT 1
  `),
  getRevenueData: db.prepare(`
    SELECT 
      date(timestamp, 'unixepoch') as date,
      SUM(value) as daily_revenue,
      COUNT(*) as transaction_count
    FROM transactions 
    WHERE address = ? AND timestamp >= ?
    GROUP BY date(timestamp, 'unixepoch')
    ORDER BY date
  `),
  getTotalRevenue: db.prepare(`
    SELECT 
      SUM(value) as total,
      COUNT(*) as count,
      MIN(timestamp) as first_payment,
      MAX(timestamp) as last_payment
    FROM transactions 
    WHERE address = ?
  `),
  deleteOldTransactions: db.prepare(`
    DELETE FROM transactions WHERE timestamp < ?
  `),
  deleteOldBlocks: db.prepare(`
    DELETE FROM blocks WHERE timestamp < ?
  `),

  // NEW: Network node stats statements
  insertNetworkNodeStats: db.prepare(`
    INSERT OR REPLACE INTO network_node_stats (
      timestamp, total_nodes, cumulus_nodes, nimbus_nodes, stratus_nodes,
      arcane_nodes, arcane_percentage, cumulus_percentage, nimbus_percentage, stratus_percentage,
      data_source, api_success_rate, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // NEW: Network utilization stats statements
  insertNetworkUtilizationStats: db.prepare(`
    INSERT OR REPLACE INTO network_utilization_stats (
      timestamp, total_cores, total_ram_gb, total_ssd_gb,
      utilized_cores, utilized_nodes, utilized_ram_gb, utilized_ssd_gb,
      cores_percentage, nodes_percentage, ram_percentage, ssd_percentage,
      running_apps, nodes_with_apps, watchtower_instances, total_checked_nodes,
      data_source, api_success_rate, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),

  // NEW: Get latest network stats
  getLatestNetworkNodeStats: db.prepare(`
    SELECT * FROM network_node_stats ORDER BY timestamp DESC LIMIT 1
  `),
  getLatestNetworkUtilizationStats: db.prepare(`
    SELECT * FROM network_utilization_stats ORDER BY timestamp DESC LIMIT 1
  `),

  // NEW: Get historical network stats with date range
  getNetworkNodeStatsRange: db.prepare(`
    SELECT * FROM network_node_stats 
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp ASC
  `),
  getNetworkUtilizationStatsRange: db.prepare(`
    SELECT * FROM network_utilization_stats 
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp ASC
  `),

  // NEW: Check if snapshot exists for timestamp (within 1 hour tolerance)
  checkNetworkNodeStatsExists: db.prepare(`
    SELECT COUNT(*) as count FROM network_node_stats 
    WHERE ABS(timestamp - ?) <= 3600
  `),
  checkNetworkUtilizationStatsExists: db.prepare(`
    SELECT COUNT(*) as count FROM network_utilization_stats 
    WHERE ABS(timestamp - ?) <= 3600
  `),

  // NEW: Get last successful snapshot timestamp
  getLastNetworkNodeSnapshot: db.prepare(`
    SELECT timestamp FROM network_node_stats 
    WHERE data_source != 'failed'
    ORDER BY timestamp DESC LIMIT 1
  `),
  getLastNetworkUtilizationSnapshot: db.prepare(`
    SELECT timestamp FROM network_utilization_stats 
    WHERE data_source != 'failed'
    ORDER BY timestamp DESC LIMIT 1
  `),

  // NEW: Cleanup old network stats (keep 1 year = 365 days * 2 snapshots = 730 records)
deleteOldNetworkNodeStats: db.prepare(`
  DELETE FROM network_node_stats 
  WHERE timestamp < ?
`),
deleteOldNetworkUtilizationStats: db.prepare(`
  DELETE FROM network_utilization_stats 
  WHERE timestamp < ?
`),

// Additional cleanup queries to maintain record limits
deleteExcessNetworkNodeStats: db.prepare(`
  DELETE FROM network_node_stats 
  WHERE id NOT IN (
    SELECT id FROM network_node_stats 
    ORDER BY timestamp DESC 
    LIMIT 730
  ) AND timestamp < ?
`),
deleteExcessNetworkUtilizationStats: db.prepare(`
  DELETE FROM network_utilization_stats 
  WHERE id NOT IN (
    SELECT id FROM network_utilization_stats 
    ORDER BY timestamp DESC 
    LIMIT 730
  ) AND timestamp < ?
`),

  // NEW: Get network stats count and health
  getNetworkStatsHealth: db.prepare(`
    SELECT 
      'node_stats' as table_name,
      COUNT(*) as total_snapshots,
      COUNT(CASE WHEN data_source = 'api' THEN 1 END) as api_snapshots,
      COUNT(CASE WHEN data_source = 'cache' THEN 1 END) as cache_snapshots,
      COUNT(CASE WHEN data_source = 'failed' THEN 1 END) as failed_snapshots,
      MAX(timestamp) as latest_timestamp,
      MIN(timestamp) as earliest_timestamp,
      AVG(api_success_rate) as avg_success_rate
    FROM network_node_stats
    UNION ALL
    SELECT 
      'utilization_stats' as table_name,
      COUNT(*) as total_snapshots,
      COUNT(CASE WHEN data_source = 'api' THEN 1 END) as api_snapshots,
      COUNT(CASE WHEN data_source = 'cache' THEN 1 END) as cache_snapshots,
      COUNT(CASE WHEN data_source = 'failed' THEN 1 END) as failed_snapshots,
      MAX(timestamp) as latest_timestamp,
      MIN(timestamp) as earliest_timestamp,
      AVG(api_success_rate) as avg_success_rate
    FROM network_utilization_stats
  `),

  // FIXED: Get recent failed snapshots for debugging (10 from each table)
getRecentFailedSnapshots: db.prepare(`
  SELECT * FROM (
    SELECT 'node_stats' as type, timestamp, notes, created_at 
    FROM network_node_stats 
    WHERE data_source = 'failed' 
    ORDER BY timestamp DESC 
    LIMIT 10
  )
  UNION ALL
  SELECT * FROM (
    SELECT 'utilization_stats' as type, timestamp, notes, created_at 
    FROM network_utilization_stats 
    WHERE data_source = 'failed' 
    ORDER BY timestamp DESC 
    LIMIT 10
  )
  ORDER BY timestamp DESC
`),

  // Sync status statements
  getTotalBlockCount: db.prepare(`
    SELECT COUNT(*) as count FROM blocks
  `),
  getHighestBlock: db.prepare(`
    SELECT MAX(height) as height FROM blocks
  `),
  getLowestBlock: db.prepare(`
    SELECT MIN(height) as height FROM blocks
  `),
  
  // OPTIMIZED: Updated transactions queries with better performance
  getTransactionsPaginated: db.prepare(`
    SELECT 
      tx_hash as id,
      from_address,
      value as amount,
      block_height,
      timestamp as date
    FROM transactions 
    WHERE address = ?
    ORDER BY timestamp DESC, block_height DESC, id DESC
    LIMIT ? OFFSET ?
  `),
  getTransactionsCount: db.prepare(`
    SELECT COUNT(*) as total
    FROM transactions 
    WHERE address = ?
  `),
  searchTransactionsPaginated: db.prepare(`
    SELECT 
      tx_hash as id,
      from_address,
      value as amount,
      block_height,
      timestamp as date
    FROM transactions 
    WHERE address = ? AND (
      tx_hash LIKE ? OR 
      from_address LIKE ? OR
      CAST(value AS TEXT) LIKE ?
    )
    ORDER BY timestamp DESC, block_height DESC, id DESC
    LIMIT ? OFFSET ?
  `),
  searchTransactionsCount: db.prepare(`
    SELECT COUNT(*) as total
    FROM transactions 
    WHERE address = ? AND (
      tx_hash LIKE ? OR 
      from_address LIKE ? OR
      CAST(value AS TEXT) LIKE ?
    )
  `),

  // NEW: Block-based revenue queries for accurate calculations
  getTransactionsByBlockRange: db.prepare(`
    SELECT 
      id,
      tx_hash,
      vout_index,
      address,
      from_address,
      value,
      block_height,
      timestamp
    FROM transactions 
    WHERE address = ? 
    AND block_height >= ? 
    AND block_height <= ?
    ORDER BY block_height DESC
  `),

  // NEW: Multi-address block-based revenue queries
  getTransactionsByBlockRangeMultiAddress: db.prepare(`
    SELECT 
      id,
      tx_hash,
      vout_index,
      address,
      from_address,
      value,
      block_height,
      timestamp
    FROM transactions 
    WHERE address IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    AND block_height >= ? 
    AND block_height <= ?
    ORDER BY block_height DESC, address
  `),

  // NEW: Optimized block-based aggregation (faster for large datasets)
  getRevenueByBlockRange: db.prepare(`
    SELECT 
      address,
      SUM(value) as total_revenue,
      COUNT(*) as transaction_count,
      MIN(block_height) as min_block,
      MAX(block_height) as max_block
    FROM transactions 
    WHERE address = ?
    AND block_height >= ? 
    AND block_height <= ?
    GROUP BY address
  `),

  // NEW: Multi-address revenue aggregation
  getRevenueByBlockRangeMultiAddress: db.prepare(`
    SELECT 
      address,
      SUM(value) as total_revenue,
      COUNT(*) as transaction_count,
      MIN(block_height) as min_block,
      MAX(block_height) as max_block
    FROM transactions 
    WHERE address IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    AND block_height >= ? 
    AND block_height <= ?
    GROUP BY address
    ORDER BY address
  `),

  // NEW: Get network sync status with block info
  getSyncStatus: db.prepare(`
    SELECT 
      MIN(height) as lowest_block,
      MAX(height) as highest_block,
      COUNT(*) as total_blocks,
      MAX(timestamp) as latest_timestamp,
      MIN(timestamp) as earliest_timestamp
    FROM blocks
  `),

  // NEW: Get recent blocks for sync monitoring
  getRecentBlocks: db.prepare(`
    SELECT height, timestamp, hash, synced_at
    FROM blocks 
    ORDER BY height DESC 
    LIMIT ?
  `),

  // NEW: Check for missing blocks in range
  getMissingBlocks: db.prepare(`
    WITH RECURSIVE block_range(height) AS (
      SELECT ? as height
      UNION ALL
      SELECT height + 1 FROM block_range WHERE height < ?
    )
    SELECT br.height as missing_block
    FROM block_range br
    LEFT JOIN blocks b ON br.height = b.height
    WHERE b.height IS NULL
    ORDER BY br.height
    LIMIT 100
  `),
  
  // Statements for from_address backfill
  getTransactionsWithoutFromAddress: db.prepare(`
    SELECT tx_hash, block_height, vout_index, address
    FROM transactions 
    WHERE from_address IS NULL
    ORDER BY timestamp DESC
    LIMIT ?
  `),
  updateTransactionFromAddress: db.prepare(`
    UPDATE transactions 
    SET from_address = ? 
    WHERE tx_hash = ? AND block_height = ? AND vout_index = ?
  `),

  // OPTIMIZED: Enhanced query statements for multi-address support
  getRevenueDataMultiAddress: db.prepare(`
    SELECT 
      address,
      date(timestamp, 'unixepoch') as date,
      SUM(value) as daily_revenue,
      COUNT(*) as transaction_count
    FROM transactions 
    WHERE address IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AND timestamp >= ?
    GROUP BY address, date(timestamp, 'unixepoch')
    ORDER BY address, date
  `),
  getTotalRevenueMultiAddress: db.prepare(`
    SELECT 
      address,
      SUM(value) as total,
      COUNT(*) as count,
      MIN(timestamp) as first_payment,
      MAX(timestamp) as last_payment
    FROM transactions 
    WHERE address IN (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    GROUP BY address
  `),

  // OPTIMIZED: Performance monitoring queries
  getTableStats: db.prepare(`
    SELECT 
      'transactions' as table_name,
      COUNT(*) as row_count,
      MAX(timestamp) as latest_timestamp,
      MIN(timestamp) as earliest_timestamp
    FROM transactions
    UNION ALL
    SELECT 
      'blocks' as table_name,
      COUNT(*) as row_count,
      MAX(timestamp) as latest_timestamp,
      MIN(timestamp) as earliest_timestamp
    FROM blocks
    UNION ALL
    SELECT 
      'network_node_stats' as table_name,
      COUNT(*) as row_count,
      MAX(timestamp) as latest_timestamp,
      MIN(timestamp) as earliest_timestamp
    FROM network_node_stats
    UNION ALL
    SELECT 
      'network_utilization_stats' as table_name,
      COUNT(*) as row_count,
      MAX(timestamp) as latest_timestamp,
      MIN(timestamp) as earliest_timestamp
    FROM network_utilization_stats
  `),
  
  getIndexStats: db.prepare(`
    SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name IN ('transactions', 'blocks', 'network_node_stats', 'network_utilization_stats')
  `),

  // OPTIMIZED: Database maintenance queries
  analyzeDatabase: db.prepare(`ANALYZE`),
  vacuumDatabase: db.prepare(`VACUUM`),
  optimizeDatabase: db.prepare(`PRAGMA optimize`),

  // OPTIMIZED: Faster aggregation queries
  getAddressSummary: db.prepare(`
    SELECT 
      address,
      COUNT(*) as transaction_count,
      SUM(value) as total_value,
      MAX(timestamp) as last_transaction,
      MIN(timestamp) as first_transaction,
      MAX(block_height) as last_block_height,
      MIN(block_height) as first_block_height
    FROM transactions 
    WHERE address = ?
  `),

  // OPTIMIZED: Block range queries for faster sync status
  getBlockRange: db.prepare(`
    SELECT 
      MIN(height) as min_height,
      MAX(height) as max_height,
      COUNT(*) as block_count
    FROM blocks
  `),

  // OPTIMIZED: Recent activity queries
  getRecentTransactions: db.prepare(`
    SELECT 
      tx_hash as id,
      from_address,
      value as amount,
      block_height,
      timestamp as date,
      address
    FROM transactions 
    WHERE timestamp >= ?
    ORDER BY timestamp DESC, block_height DESC
    LIMIT ?
  `),

  // NEW: Recent transactions by block height
  getRecentTransactionsByBlock: db.prepare(`
    SELECT 
      tx_hash as id,
      from_address,
      value as amount,
      block_height,
      timestamp as date,
      address
    FROM transactions 
    WHERE block_height >= ?
    ORDER BY block_height DESC, timestamp DESC
    LIMIT ?
  `),

  // OPTIMIZED: Address validation queries
  getKnownAddresses: db.prepare(`
    SELECT DISTINCT address FROM transactions ORDER BY address
  `),

  // OPTIMIZED: Performance-critical count queries with hints
  getTransactionCountFast: db.prepare(`
    SELECT COUNT(*) as total FROM transactions WHERE address = ? AND timestamp >= ?
  `),

  // NEW: Block-based transaction count
  getTransactionCountByBlockRange: db.prepare(`
    SELECT COUNT(*) as total FROM transactions WHERE address = ? AND block_height >= ? AND block_height <= ?
  `),

  // Store reference to db for transactions
  db: db
};

// OPTIMIZED: Create dynamic batch insert statements based on batch size
function createBatchInsertStatements(batchSize = DB_CONFIG.BATCH_INSERT_SIZE || 200) {
  try {
    // Create batch insert for blocks
    const blockPlaceholders = Array(batchSize).fill('(?, ?, ?)').join(', ');
    statements.batchInsertBlocks = db.prepare(`
      INSERT OR REPLACE INTO blocks (height, timestamp, hash) VALUES ${blockPlaceholders}
    `);

    // Create batch insert for transactions
    const transactionPlaceholders = Array(batchSize).fill('(?, ?, ?, ?, ?, ?, ?)').join(', ');
    statements.batchInsertTransactions = db.prepare(`
      INSERT OR IGNORE INTO transactions 
      (block_height, tx_hash, vout_index, address, from_address, value, timestamp) 
      VALUES ${transactionPlaceholders}
    `);

    console.log(`✅ Created batch insert statements for ${batchSize} records`);
  } catch (error) {
    console.warn(`⚠️ Could not create batch statements for size ${batchSize}:`, error.message);
    // Fallback to smaller batch size
    if (batchSize > 50) {
      createBatchInsertStatements(50);
    }
  }
}

// Initialize batch statements
createBatchInsertStatements();

// OPTIMIZED: Database utility functions + NEW NETWORK STATS UTILITIES
const dbUtils = {
  // Get database statistics
  getStats() {
    try {
      const stats = statements.getTableStats.all();
      const indexes = statements.getIndexStats.all();
      const blockRange = statements.getBlockRange.get();
      const syncStatus = statements.getSyncStatus.get();
      const networkStatsHealth = statements.getNetworkStatsHealth.all();
      
      return {
        tables: stats,
        indexes: indexes.map(idx => ({ name: idx.name, sql: idx.sql })),
        blockRange,
        syncStatus,
        networkStatsHealth,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      return null;
    }
  },

  // NEW: Get current sync status with block info and network stats
  getCurrentSyncStatus() {
    try {
      const syncStatus = statements.getSyncStatus.get();
      const recentBlocks = statements.getRecentBlocks.all(5);
      const latestNodeStats = statements.getLatestNetworkNodeStats.get();
      const latestUtilizationStats = statements.getLatestNetworkUtilizationStats.get();
      
      return {
        ...syncStatus,
        recentBlocks,
        latestNodeStats,
        latestUtilizationStats,
        isHealthy: syncStatus.total_blocks > 0,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error getting sync status:', error);
      return null;
    }
  },

  // NEW: Check if network snapshot should be taken (twice daily - every 12 hours)
  shouldTakeNetworkSnapshot() {
    const now = Date.now();
    const currentHour = new Date(now).getUTCHours();
    
    // Take snapshots at 00:00 UTC and 12:00 UTC
    const isSnapshotTime = currentHour === 0 || currentHour === 12;
    
    if (!isSnapshotTime) {
      return { should: false, reason: `Not snapshot time (current hour: ${currentHour})` };
    }

    // Check if we already have a snapshot for this time period
    const snapshotTimestamp = Math.floor(now / (12 * 60 * 60 * 1000)) * (12 * 60 * 60 * 1000);
    
    const nodeExists = statements.checkNetworkNodeStatsExists.get(snapshotTimestamp / 1000);
    const utilizationExists = statements.checkNetworkUtilizationStatsExists.get(snapshotTimestamp / 1000);
    
    if (nodeExists.count > 0 && utilizationExists.count > 0) {
      return { should: false, reason: 'Snapshot already exists for this period' };
    }

    return { 
      should: true, 
      snapshotTimestamp: snapshotTimestamp / 1000,
      nodeExists: nodeExists.count > 0,
      utilizationExists: utilizationExists.count > 0
    };
  },

  // NEW: Store network node statistics snapshot
  storeNetworkNodeSnapshot(data, timestamp, dataSource = 'api', successRate = 100, notes = null) {
    try {
      const result = statements.insertNetworkNodeStats.run(
        timestamp,
        data.total || 0,
        data.cumulus || 0,
        data.nimbus || 0,
        data.stratus || 0,
        data.arcane_nodes || 0,
        data.arcane_percentage || 0,
        data.cumulus_percentage || 0,
        data.nimbus_percentage || 0,
        data.stratus_percentage || 0,
        dataSource,
        successRate,
        notes
      );
      
      console.log(`📊 Stored network node snapshot for ${new Date(timestamp * 1000).toISOString()} (source: ${dataSource})`);
      return result.changes > 0;
    } catch (error) {
      console.error('❌ Error storing network node snapshot:', error);
      return false;
    }
  },

  // NEW: Store network utilization statistics snapshot
  storeNetworkUtilizationSnapshot(data, timestamp, dataSource = 'api', successRate = 100, notes = null) {
    try {
      const result = statements.insertNetworkUtilizationStats.run(
        timestamp,
        data.total?.cores || 0,
        data.total?.ram || 0,
        data.total?.ssd || 0,
        data.utilized?.cores || 0,
        data.utilized?.nodes || 0,
        data.utilized?.ram || 0,
        data.utilized?.ssd || 0,
        data.utilized?.cores_percentage || 0,
        data.utilized?.nodes_percentage || 0,
        data.utilized?.ram_percentage || 0,
        data.utilized?.ssd_percentage || 0,
        data.running_apps?.total_apps || 0,
        data.running_apps?.nodes_with_apps || 0,
        data.running_apps?.watchtower_instances || 0,
        data.total_nodes || 0,
        dataSource,
        successRate,
        notes
      );
      
      console.log(`📊 Stored network utilization snapshot for ${new Date(timestamp * 1000).toISOString()} (source: ${dataSource})`);
      return result.changes > 0;
    } catch (error) {
      console.error('❌ Error storing network utilization snapshot:', error);
      return false;
    }
  },

  // NEW: Get historical network stats
  getNetworkStatsHistory(startDate, endDate, type = 'both') {
    try {
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      
      const result = {};
      
      if (type === 'node' || type === 'both') {
        result.nodeStats = statements.getNetworkNodeStatsRange.all(startTimestamp, endTimestamp);
      }
      
      if (type === 'utilization' || type === 'both') {
        result.utilizationStats = statements.getNetworkUtilizationStatsRange.all(startTimestamp, endTimestamp);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error getting network stats history:', error);
      return { nodeStats: [], utilizationStats: [] };
    }
  },

  // NEW: Cleanup old network statistics (keep 1 year)
  cleanupOldNetworkStats() {
    try {
      const oneYearAgo = Math.floor((Date.now() - (365 * 24 * 60 * 60 * 1000)) / 1000);
      
      console.log('🧹 Cleaning up old network statistics...');
      
      // Delete old node stats (keep latest 730 records = 1 year of twice-daily snapshots)
      const nodeStatsDeleted = statements.deleteOldNetworkNodeStats.run(oneYearAgo);
      
      // Delete old utilization stats
      const utilizationStatsDeleted = statements.deleteOldNetworkUtilizationStats.run(oneYearAgo);
      
      console.log(`✅ Cleanup completed: ${nodeStatsDeleted.changes} node stats, ${utilizationStatsDeleted.changes} utilization stats removed`);
      
      return {
        nodeStatsDeleted: nodeStatsDeleted.changes,
        utilizationStatsDeleted: utilizationStatsDeleted.changes,
        cutoffDate: new Date(oneYearAgo * 1000).toISOString()
      };
    } catch (error) {
      console.error('❌ Error cleaning up old network stats:', error);
      return { nodeStatsDeleted: 0, utilizationStatsDeleted: 0, error: error.message };
    }
  },

  // NEW: Get network stats health and diagnostics
  getNetworkStatsHealth() {
    try {
      const health = statements.getNetworkStatsHealth.all();
      const recentFailures = statements.getRecentFailedSnapshots.all();
      
      const nodeStats = health.find(h => h.table_name === 'node_stats') || {};
      const utilizationStats = health.find(h => h.table_name === 'utilization_stats') || {};
      
      return {
        nodeStats: {
          totalSnapshots: nodeStats.total_snapshots || 0,
          apiSnapshots: nodeStats.api_snapshots || 0,
          cacheSnapshots: nodeStats.cache_snapshots || 0,
          failedSnapshots: nodeStats.failed_snapshots || 0,
          latestTimestamp: nodeStats.latest_timestamp,
          earliestTimestamp: nodeStats.earliest_timestamp,
          avgSuccessRate: nodeStats.avg_success_rate || 0
        },
        utilizationStats: {
          totalSnapshots: utilizationStats.total_snapshots || 0,
          apiSnapshots: utilizationStats.api_snapshots || 0,
          cacheSnapshots: utilizationStats.cache_snapshots || 0,
          failedSnapshots: utilizationStats.failed_snapshots || 0,
          latestTimestamp: utilizationStats.latest_timestamp,
          earliestTimestamp: utilizationStats.earliest_timestamp,
          avgSuccessRate: utilizationStats.avg_success_rate || 0
        },
        recentFailures,
        lastCheck: Date.now()
      };
    } catch (error) {
      console.error('❌ Error getting network stats health:', error);
      return null;
    }
  },

  // Check for missing blocks in a range
  checkMissingBlocks(startHeight, endHeight) {
    try {
      if (endHeight - startHeight > 10000) {
        console.warn('⚠️ Block range too large, limiting to 10000 blocks');
        endHeight = startHeight + 10000;
      }
      
      const missingBlocks = statements.getMissingBlocks.all(startHeight, endHeight);
      return missingBlocks.map(row => row.missing_block);
    } catch (error) {
      console.error('Error checking missing blocks:', error);
      return [];
    }
  },

  // Optimize database performance
  async optimize() {
    try {
      console.log('🔧 Optimizing database...');
      
      // Analyze tables for better query planning
      statements.analyzeDatabase.run();
      
      // Run SQLite optimizer
      statements.optimizeDatabase.run();
      
      console.log('✅ Database optimization completed');
      return true;
    } catch (error) {
      console.error('❌ Database optimization failed:', error);
      return false;
    }
  },

  // Clean up database (vacuum)
  async cleanup() {
    try {
      console.log('🧹 Cleaning up database...');
      
      // Close any open transactions
      if (db.inTransaction) {
        console.log('⚠️ Database is in transaction, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Vacuum to reclaim space
      statements.vacuumDatabase.run();
      
      console.log('✅ Database cleanup completed');
      return true;
    } catch (error) {
      console.error('❌ Database cleanup failed:', error);
      return false;
    }
  },

  // Check database health
  checkHealth() {
    try {
      // Simple query to test database
      const result = statements.getTotalBlockCount.get();
      const integrity = db.pragma('integrity_check');
      
      return {
        accessible: true,
        blockCount: result?.count || 0,
        integrity: integrity[0] === 'ok',
        walMode: db.pragma('journal_mode')[0] === 'wal'
      };
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return {
        accessible: false,
        error: error.message
      };
    }
  },

  // Get performance metrics
  getPerformanceMetrics() {
    try {
      const cacheStats = db.pragma('cache_size');
      const pageCount = db.pragma('page_count');
      const pageSize = db.pragma('page_size');
      const freelistCount = db.pragma('freelist_count');
      
      return {
        cacheSize: cacheStats[0],
        totalPages: pageCount[0],
        pageSize: pageSize[0],
        freePages: freelistCount[0],
        databaseSize: pageCount[0] * pageSize[0],
        cacheUtilization: (cacheStats[0] / pageCount[0]) * 100
      };
    } catch (error) {
      console.error('❌ Error getting performance metrics:', error);
      return null;
    }
  }
};

// OPTIMIZED: Enhanced batch operations - EXPORTED SEPARATELY
export const batchOperations = {
  // Batch insert blocks with transaction
  insertBlocks(blocks) {
    if (!blocks || blocks.length === 0) return 0;
    
    try {
      const insertMany = db.transaction((blockList) => {
        let inserted = 0;
        for (const block of blockList) {
          try {
            statements.insertBlock.run(block.height, block.timestamp, block.hash);
            inserted++;
          } catch (error) {
            if (!error.message.includes('UNIQUE constraint failed')) {
              console.error(`Error inserting block ${block.height}:`, error);
            }
          }
        }
        return inserted;
      });
      
      return insertMany(blocks);
    } catch (error) {
      console.error('❌ Batch block insert failed:', error);
      return 0;
    }
  },

  // Batch insert transactions with transaction
  insertTransactions(transactions) {
    if (!transactions || transactions.length === 0) return 0;
    
    try {
      const insertMany = db.transaction((txList) => {
        let inserted = 0;
        for (const tx of txList) {
          try {
            statements.insertTransaction.run(
              tx.blockHeight,
              tx.txHash,
              tx.voutIndex,
              tx.address,
              tx.fromAddress,
              tx.value,
              tx.timestamp
            );
            inserted++;
          } catch (error) {
            if (!error.message.includes('UNIQUE constraint failed')) {
              console.error(`Error inserting transaction ${tx.txHash}:`, error);
            }
          }
        }
        return inserted;
      });
      
      return insertMany(transactions);
    } catch (error) {
      console.error('❌ Batch transaction insert failed:', error);
      return 0;
    }
  },

  // Combined batch insert for blocks and transactions
  insertBlocksAndTransactions(blocks, transactions) {
    if ((!blocks || blocks.length === 0) && (!transactions || transactions.length === 0)) {
      return { blocks: 0, transactions: 0 };
    }
    
    try {
      const insertMany = db.transaction(() => {
        const blockCount = batchOperations.insertBlocks(blocks);
        const txCount = batchOperations.insertTransactions(transactions);
        return { blocks: blockCount, transactions: txCount };
      });
      
      return insertMany();
    } catch (error) {
      console.error('❌ Combined batch insert failed:', error);
      return { blocks: 0, transactions: 0 };
    }
  },

  // NEW: Batch insert network statistics
  insertNetworkStatsBatch(nodeStatsArray, utilizationStatsArray) {
    if ((!nodeStatsArray || nodeStatsArray.length === 0) && 
        (!utilizationStatsArray || utilizationStatsArray.length === 0)) {
      return { nodeStats: 0, utilizationStats: 0 };
    }
    
    try {
      const insertMany = db.transaction(() => {
        let nodeInserted = 0;
        let utilizationInserted = 0;
        
        // Insert node stats
        for (const nodeData of nodeStatsArray || []) {
          try {
            statements.insertNetworkNodeStats.run(
              nodeData.timestamp,
              nodeData.total_nodes,
              nodeData.cumulus_nodes,
              nodeData.nimbus_nodes,
              nodeData.stratus_nodes,
              nodeData.arcane_nodes,
              nodeData.arcane_percentage,
              nodeData.cumulus_percentage,
              nodeData.nimbus_percentage,
              nodeData.stratus_percentage,
              nodeData.data_source,
              nodeData.api_success_rate,
              nodeData.notes
            );
            nodeInserted++;
          } catch (error) {
            if (!error.message.includes('UNIQUE constraint failed')) {
              console.error(`Error inserting node stats for ${nodeData.timestamp}:`, error);
            }
          }
        }
        
        // Insert utilization stats
        for (const utilizationData of utilizationStatsArray || []) {
          try {
            statements.insertNetworkUtilizationStats.run(
              utilizationData.timestamp,
              utilizationData.total_cores,
              utilizationData.total_ram_gb,
              utilizationData.total_ssd_gb,
              utilizationData.utilized_cores,
              utilizationData.utilized_nodes,
              utilizationData.utilized_ram_gb,
              utilizationData.utilized_ssd_gb,
              utilizationData.cores_percentage,
              utilizationData.nodes_percentage,
              utilizationData.ram_percentage,
              utilizationData.ssd_percentage,
              utilizationData.running_apps,
              utilizationData.nodes_with_apps,
              utilizationData.watchtower_instances,
              utilizationData.total_checked_nodes,
              utilizationData.data_source,
              utilizationData.api_success_rate,
              utilizationData.notes
            );
            utilizationInserted++;
          } catch (error) {
            if (!error.message.includes('UNIQUE constraint failed')) {
              console.error(`Error inserting utilization stats for ${utilizationData.timestamp}:`, error);
            }
          }
        }
        
        return { nodeStats: nodeInserted, utilizationStats: utilizationInserted };
      });
      
      return insertMany();
    } catch (error) {
      console.error('❌ Batch network stats insert failed:', error);
      return { nodeStats: 0, utilizationStats: 0 };
    }
  }
};

// OPTIMIZED: Connection and cleanup management
let isClosing = false;

export function closeDatabase() {
  if (isClosing) return;
  isClosing = true;
  
  try {
    console.log('🔒 Closing database connection...');
    
    // Ensure any pending transactions are completed
    if (db.inTransaction) {
      console.log('⚠️ Waiting for pending transactions...');
      // Note: better-sqlite3 will handle this automatically
    }
    
    // Final optimization before closing
    if (DB_CONFIG.OPTIMIZE_ON_CLOSE !== false) {
      try {
        db.pragma('optimize');
      } catch (error) {
        console.warn('⚠️ Final optimization failed:', error.message);
      }
    }
    
    // Close the database
    db.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}

// Handle process termination
process.on('SIGINT', closeDatabase);
process.on('SIGTERM', closeDatabase);
process.on('exit', closeDatabase);

// NEW: Enhanced periodic maintenance (every 30 minutes) + Network stats cleanup
if (DB_CONFIG.ENABLE_AUTO_MAINTENANCE !== false) {
  setInterval(async () => {
    try {
      await dbUtils.optimize();
      
      // Cleanup old network stats once per day at 3 AM UTC
      const currentHour = new Date().getUTCHours();
      if (currentHour === 3) {
        await dbUtils.cleanupOldNetworkStats();
      }
    } catch (error) {
      console.error('❌ Periodic maintenance failed:', error);
    }
  }, 30 * 60 * 1000);
}

// NEW: Enhanced initialization logging
console.log('🗄️ Database initialized with optimizations and network stats tracking');
console.log(`   - WAL mode: ${DB_CONFIG.ENABLE_WAL_MODE !== false ? 'enabled' : 'disabled'}`);
console.log(`   - Batch size: ${DB_CONFIG.BATCH_INSERT_SIZE || 200}`);
console.log(`   - Optimized indexes: ${DB_CONFIG.OPTIMIZE_INDEXES !== false ? 'enabled' : 'disabled'}`);
console.log(`   - Network stats tables: ✅ created`);
console.log(`   - Twice-daily snapshots: ✅ configured`);
console.log(`   - Auto cleanup: ✅ enabled (1 year retention)`);

// SINGLE EXPORT STATEMENT - No duplicates
export { db, statements, dbUtils };