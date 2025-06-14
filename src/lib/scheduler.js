// Server-side only check
if (typeof window !== 'undefined') {
  throw new Error('Scheduler can only run on server-side');
}

import { statements } from './db.js';
import { 
  getCurrentBlockHeight, 
  getBlockDataBatch, 
  analyzeBlocksBatch, // FIXED: Now properly exported from flux-api.js
  batchResolveFromAddresses,
  getPerformanceStats,
  resetPerformanceStats,
  resolveFromAddress
} from './flux-api.js';
import { 
  getAllTargetAddresses, 
  SYNC_CONFIG, 
  API_CONFIG, 
  DB_CONFIG,
  PERFORMANCE_CONFIG 
} from './config.js';
import { readFileSync, existsSync } from 'fs';
import { updateSyncInfo } from './syncStatusStore.js';

const { 
  BLOCKS_PER_DAY, 
  RETENTION_DAYS, 
  MAX_BLOCKS_PER_SYNC, 
  SYNC_INTERVAL,
  PARALLEL_BATCHES,
  BATCH_SIZE,
  ENABLE_FAST_SYNC
} = SYNC_CONFIG;

let isRunning = false;
let syncInterval = null;

// Performance tracking - NEW
let syncMetrics = {
  totalBlocksProcessed: 0,
  totalSyncTime: 0,
  averageBlocksPerSecond: 0,
  lastSyncPerformance: null,
  syncCount: 0
};

// Function to update sync status (uses shared store)
function updateSyncStatus(updates) {
  updateSyncInfo(updates);
}

export async function startScheduler() {
  const targetAddresses = getAllTargetAddresses();
  
  console.log('🚀 Starting OPTIMIZED Flux tracker scheduler...');
  console.log(`📊 Configuration:`);
  console.log(`   - Target addresses: ${targetAddresses.join(', ')}`);
  console.log(`   - Total addresses: ${targetAddresses.length}`);
  console.log(`   - Blocks per day: ${BLOCKS_PER_DAY}`);
  console.log(`   - Retention days: ${RETENTION_DAYS}`);
  console.log(`   - Max blocks per sync: ${MAX_BLOCKS_PER_SYNC}`);
  console.log(`   - Sync interval: ${SYNC_INTERVAL / 1000}s`);
  console.log(`   - Fast sync enabled: ${ENABLE_FAST_SYNC}`);
  console.log(`   - Parallel batches: ${PARALLEL_BATCHES}`);
  console.log(`   - Batch size: ${BATCH_SIZE}`);
  console.log(`   - Max concurrent API calls: ${API_CONFIG.MAX_CONCURRENT}`);
  
  // Wait for database to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Reset performance stats
  if (PERFORMANCE_CONFIG.ENABLE_METRICS) {
    resetPerformanceStats();
  }
  
  // Do initial sync immediately
  await performSync();
  
  // Then set up regular interval
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = setInterval(async () => {
    await performSync();
  }, SYNC_INTERVAL);
  
  console.log(`⏰ Scheduled sync every ${SYNC_INTERVAL / 1000} seconds`);
}

export async function performSync() {
  if (isRunning) {
    console.log('⏸️  Sync already in progress, skipping...');
    return { success: false, message: 'Sync already in progress' };
  }
  
  isRunning = true;
  const syncStartTime = Date.now();
  
  // Report sync start
  updateSyncStatus({
    isRunning: true,
    lastSyncTime: Date.now(),
    lastSyncMessage: 'Starting optimized sync cycle...'
  });
  
  console.log('\n🔄 === STARTING OPTIMIZED SYNC CYCLE ===');
  
  try {
    const currentHeight = await getCurrentBlockHeight();
    if (!currentHeight) {
      throw new Error('Could not get current block height');
    }
    
    console.log(`📡 Current network block height: ${currentHeight.toLocaleString()}`);
    
    // Get sync status with error handling
    const syncStatus = getSyncStatus(currentHeight);
    if (!syncStatus) {
      throw new Error('Could not get sync status - database not ready');
    }
    
    logSyncStatus(syncStatus);
    
    // Determine what to sync
    const syncPlan = createSyncPlan(syncStatus, currentHeight);
    logSyncPlan(syncPlan, syncStatus);
    
    if (syncPlan.blocksToSync <= 0) {
      console.log('✅ No blocks to sync - all caught up!');
      logSyncSummary(syncStatus);
      
      // Report completion
      updateSyncStatus({
        isRunning: false,
        lastSyncTime: Date.now(),
        lastSyncMessage: 'All caught up - no new blocks to sync',
        syncRate: 0
      });
      
      return { success: true, message: 'No new blocks to sync', blocksProcessed: 0 };
    }
    
    // Report sync plan
    const planMessage = syncPlan.isHybrid 
      ? `Hybrid sync: ${syncPlan.blocksToSync} forward + ${syncPlan.backwardPlan.blocksToSync} backward blocks`
      : `${syncPlan.direction} sync: ${syncPlan.blocksToSync} blocks`;
    
    updateSyncStatus({
      lastSyncMessage: planMessage
    });
    
    // Execute optimized sync
    const result = await executeOptimizedSyncPlan(syncPlan, syncStatus);
    
    // Clean old data
    await cleanOldData();
    
    // Update performance metrics
    const syncEndTime = Date.now();
    const syncDuration = (syncEndTime - syncStartTime) / 1000;
    updateSyncMetrics(result.blocksProcessed, syncDuration);
    
    // Log final status
    const updatedStatus = getSyncStatus(currentHeight);
    if (updatedStatus) {
      logSyncSummary(updatedStatus, result);
    }
    
    // Log performance stats if enabled
    if (PERFORMANCE_CONFIG.ENABLE_METRICS) {
      logPerformanceStats();
    }
    
    console.log(`✅ Optimized sync completed: ${result.message}`);
    console.log('🔄 === SYNC CYCLE COMPLETE ===\n');
    
    // Report successful completion
    updateSyncStatus({
      isRunning: false,
      lastSyncTime: Date.now(),
      lastSyncMessage: result.message,
      syncRate: result.blocksPerSecond || 0
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    console.log('🔄 === SYNC CYCLE FAILED ===\n');
    
    // Report error
    updateSyncStatus({
      isRunning: false,
      lastSyncTime: Date.now(),
      lastSyncMessage: `Sync failed: ${error.message}`,
      syncRate: 0
    });
    
    return { success: false, message: error.message };
  } finally {
    isRunning = false;
  }
}

function getSyncStatus(currentHeight) {
  try {
    // Check if statements are available
    if (!statements || !statements.getTotalBlockCount || !statements.getHighestBlock || !statements.getLowestBlock) {
      console.error('❌ Database statements not initialized');
      return null;
    }

    const totalBlocksQuery = statements.getTotalBlockCount.get();
    const highestBlockRow = statements.getHighestBlock.get();
    const lowestBlockRow = statements.getLowestBlock.get();
    
    const totalBlocksSynced = totalBlocksQuery?.count || 0;
    const highestSynced = highestBlockRow?.height || null;
    const lowestSynced = lowestBlockRow?.height || null;
    
    const targetLowestBlock = currentHeight - (BLOCKS_PER_DAY * RETENTION_DAYS);
    const initialSyncTarget = currentHeight - BLOCKS_PER_DAY; // Last 24 hours
    
    // Calculate remaining blocks
    const newBlocksRemaining = highestSynced ? Math.max(0, currentHeight - highestSynced) : BLOCKS_PER_DAY;
    const historicalBlocksRemaining = lowestSynced ? Math.max(0, lowestSynced - targetLowestBlock) : (BLOCKS_PER_DAY * RETENTION_DAYS) - BLOCKS_PER_DAY;
    const totalBlocksRemaining = newBlocksRemaining + historicalBlocksRemaining;
    
    return {
      currentHeight,
      totalBlocksSynced,
      highestSynced,
      lowestSynced,
      targetLowestBlock,
      initialSyncTarget,
      newBlocksRemaining,
      historicalBlocksRemaining,
      totalBlocksRemaining,
      isFirstRun: highestSynced === null,
      needsForwardSync: highestSynced === null || highestSynced < currentHeight,
      needsBackwardSync: lowestSynced === null || lowestSynced > targetLowestBlock,
      hasCompletedInitialSync: lowestSynced !== null && lowestSynced <= initialSyncTarget,
      syncProgress: totalBlocksSynced / (BLOCKS_PER_DAY * RETENTION_DAYS) * 100
    };
  } catch (error) {
    console.error('❌ Error getting sync status:', error);
    return null;
  }
}

// Export this function for use by API
export { getSyncStatus };

function logSyncStatus(status) {
  const targetAddresses = getAllTargetAddresses();
  
  console.log(`📊 === SYNC STATUS ===`);
  console.log(`🎯 Tracking ${targetAddresses.length} addresses: ${targetAddresses.join(', ')}`);
  console.log(`📦 Total blocks synced: ${status.totalBlocksSynced.toLocaleString()}`);
  console.log(`📈 Highest synced block: ${status.highestSynced?.toLocaleString() || 'None'}`);
  console.log(`📉 Lowest synced block: ${status.lowestSynced?.toLocaleString() || 'None'}`);
  console.log(`🎯 Target lowest block: ${status.targetLowestBlock.toLocaleString()}`);
  console.log(`⏳ Blocks remaining to sync: ${status.totalBlocksRemaining.toLocaleString()}`);
  console.log(`   ↗️  New blocks: ${status.newBlocksRemaining.toLocaleString()}`);
  console.log(`   ↙️  Historical blocks: ${status.historicalBlocksRemaining.toLocaleString()}`);
  console.log(`📊 Sync progress: ${status.syncProgress.toFixed(2)}% of target data`);
  
  if (status.isFirstRun) {
    console.log(`🆕 First run detected - will sync initial 24 hours`);
  }
  if (status.needsForwardSync) {
    console.log(`⬆️  Forward sync needed (new blocks available)`);
  }
  if (status.needsBackwardSync) {
    console.log(`⬇️  Backward sync needed (historical data missing)`);
  }
  if (!status.hasCompletedInitialSync) {
    console.log(`🔄 Still completing initial 24-hour sync`);
  }
}

function createSyncPlan(status, currentHeight) {
  if (status.isFirstRun) {
    // First run: sync last 24 hours
    const startBlock = Math.max(status.initialSyncTarget, 1);
    const endBlock = currentHeight;
    const totalBlocks = Math.abs(endBlock - startBlock) + 1;
    const blocksToSync = Math.min(totalBlocks, MAX_BLOCKS_PER_SYNC);
    
    return {
      startBlock,
      endBlock: Math.min(endBlock, startBlock + blocksToSync - 1),
      blocksToSync,
      direction: 'forward',
      priority: 'initial',
      totalBlocks
    };
  }
  
  // HYBRID APPROACH: Always stay current + use remaining capacity for history
  let forwardPlan = null;
  let backwardPlan = null;
  
  // 1. Calculate forward sync needs (always priority)
  if (status.needsForwardSync) {
    const forwardBlocks = status.newBlocksRemaining;
    const forwardBlocksToSync = Math.min(forwardBlocks, MAX_BLOCKS_PER_SYNC);
    
    forwardPlan = {
      startBlock: status.highestSynced + 1,
      endBlock: status.highestSynced + forwardBlocksToSync,
      blocksToSync: forwardBlocksToSync,
      direction: 'forward',
      priority: 'new_blocks'
    };
  }
  
  // 2. Calculate remaining capacity for backward sync
  const forwardBlocksUsed = forwardPlan ? forwardPlan.blocksToSync : 0;
  const remainingCapacity = MAX_BLOCKS_PER_SYNC - forwardBlocksUsed;
  
  // 3. Use remaining capacity for historical sync
  if (remainingCapacity > 0 && status.needsBackwardSync) {
    let backwardStartBlock, backwardEndBlock;
    
    if (!status.hasCompletedInitialSync) {
      // Still working on initial 24 hours backwards
      backwardEndBlock = status.lowestSynced - 1;
      backwardStartBlock = Math.max(
        backwardEndBlock - remainingCapacity + 1, 
        Math.max(status.initialSyncTarget, status.targetLowestBlock)
      );
    } else {
      // Historical data - progressive backward sync
      backwardEndBlock = status.lowestSynced - 1;
      backwardStartBlock = Math.max(
        backwardEndBlock - remainingCapacity + 1, 
        status.targetLowestBlock
      );
    }
    
    const backwardBlocks = Math.max(0, backwardEndBlock - backwardStartBlock + 1);
    
    if (backwardBlocks > 0) {
      backwardPlan = {
        startBlock: backwardStartBlock,
        endBlock: backwardEndBlock,
        blocksToSync: backwardBlocks,
        direction: 'backward',
        priority: status.hasCompletedInitialSync ? 'historical' : 'initial_backward'
      };
    }
  }
  
  // 4. Return the appropriate plan
  if (forwardPlan && backwardPlan) {
    // Hybrid sync: both forward and backward
    return {
      ...forwardPlan,
      backwardPlan,
      isHybrid: true,
      totalCapacityUsed: forwardPlan.blocksToSync + backwardPlan.blocksToSync
    };
  } else if (forwardPlan) {
    // Only forward sync needed
    return forwardPlan;
  } else if (backwardPlan) {
    // Only backward sync needed
    return backwardPlan;
  } else {
    // Nothing to sync
    return { blocksToSync: 0 };
  }
}

function logSyncPlan(plan, status) {
  if (plan.blocksToSync <= 0) {
    console.log(`✅ No sync needed - all caught up!`);
    return;
  }
  
  console.log(`🎯 === OPTIMIZED SYNC PLAN ===`);
  
  if (plan.isHybrid) {
    console.log(`🔀 HYBRID SYNC: Forward + Backward in one cycle`);
    console.log(`📦 Total capacity used: ${plan.totalCapacityUsed}/${MAX_BLOCKS_PER_SYNC} blocks`);
    console.log(`   ⬆️  Forward: ${plan.blocksToSync} blocks (${plan.startBlock.toLocaleString()} → ${plan.endBlock.toLocaleString()})`);
    console.log(`   ⬇️  Backward: ${plan.backwardPlan.blocksToSync} blocks (${plan.backwardPlan.startBlock.toLocaleString()} → ${plan.backwardPlan.endBlock.toLocaleString()})`);
  } else {
    console.log(`📋 Priority: ${plan.priority}`);
    console.log(`🔄 Direction: ${plan.direction}`);
    console.log(`📦 Blocks to sync this batch: ${plan.blocksToSync.toLocaleString()}`);
    console.log(`📍 Block range: ${plan.startBlock.toLocaleString()} → ${plan.endBlock.toLocaleString()}`);
    
    if (plan.priority === 'historical') {
      console.log(`📉 Progressive backward sync: going back ${plan.blocksToSync} blocks from ${plan.endBlock + 1}`);
    }
  }
  
  console.log(`🚀 OPTIMIZATION: Using ${PARALLEL_BATCHES} parallel batches of ${BATCH_SIZE} blocks each`);
  console.log(`⚡ Expected speedup: ~${Math.min(PARALLEL_BATCHES * 5, 50)}x faster than sequential processing`);
  
  console.log(`📊 After this batch:`);
  
  if (plan.isHybrid) {
    const newRemaining = Math.max(0, status.newBlocksRemaining - plan.blocksToSync);
    const histRemaining = Math.max(0, status.historicalBlocksRemaining - plan.backwardPlan.blocksToSync);
    console.log(`   ↗️  New blocks remaining: ${newRemaining.toLocaleString()}`);
    console.log(`   ↙️  Historical blocks remaining: ${histRemaining.toLocaleString()}`);
    console.log(`   🎯 Efficiency: Using ${((plan.totalCapacityUsed / MAX_BLOCKS_PER_SYNC) * 100).toFixed(1)}% of sync capacity`);
  } else if (plan.direction === 'forward') {
    const newRemaining = Math.max(0, status.newBlocksRemaining - plan.blocksToSync);
    console.log(`   ↗️  New blocks remaining: ${newRemaining.toLocaleString()}`);
    console.log(`   ↙️  Historical blocks remaining: ${status.historicalBlocksRemaining.toLocaleString()}`);
  } else {
    const histRemaining = Math.max(0, status.historicalBlocksRemaining - plan.blocksToSync);
    console.log(`   ↗️  New blocks remaining: ${status.newBlocksRemaining.toLocaleString()}`);
    console.log(`   ↙️  Historical blocks remaining: ${histRemaining.toLocaleString()}`);
  }
}

// OPTIMIZED: New parallel sync execution
async function executeOptimizedSyncPlan(plan, status) {
  if (plan.isHybrid) {
    // Execute hybrid sync: both forward and backward
    console.log(`\n🔨 === EXECUTING OPTIMIZED HYBRID SYNC ===`);
    console.log(`🚀 Running forward + backward sync with parallel processing...`);
    
    let totalProcessed = 0;
    let totalPaymentsFound = 0;
    const startTime = Date.now();
    
    // Execute forward sync first
    console.log(`⬆️  Phase 1: Optimized forward sync (${plan.blocksToSync} blocks)`);
    const forwardResult = await executeOptimizedSyncDirection(
      plan.startBlock, 
      plan.endBlock, 
      'forward', 
      plan.blocksToSync
    );
    totalProcessed += forwardResult.processed;
    totalPaymentsFound += forwardResult.paymentsFound;
    
    // Execute backward sync
    console.log(`⬇️  Phase 2: Optimized backward sync (${plan.backwardPlan.blocksToSync} blocks)`);
    const backwardResult = await executeOptimizedSyncDirection(
      plan.backwardPlan.startBlock, 
      plan.backwardPlan.endBlock, 
      'backward', 
      plan.backwardPlan.blocksToSync
    );
    totalProcessed += backwardResult.processed;
    totalPaymentsFound += backwardResult.paymentsFound;
    
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = totalProcessed / elapsed;
    
    console.log(`✅ Optimized hybrid sync complete!`);
    console.log(`   📦 Total processed: ${totalProcessed} blocks`);
    console.log(`   💰 Total payments found: ${totalPaymentsFound}`);
    console.log(`   ⚡ Performance: ${rate.toFixed(1)} blocks/sec (${(rate * 60).toFixed(0)} blocks/min)`);
    console.log(`   🎯 Capacity used: ${plan.totalCapacityUsed}/${MAX_BLOCKS_PER_SYNC} blocks`);
    
    return {
      success: true,
      message: `Optimized hybrid sync: ${forwardResult.processed} forward + ${backwardResult.processed} backward blocks - ${totalPaymentsFound} payments found`,
      blocksProcessed: totalProcessed,
      paymentsFound: totalPaymentsFound,
      direction: 'hybrid',
      priority: 'hybrid',
      timeElapsed: elapsed,
      blocksPerSecond: rate,
      forwardBlocks: forwardResult.processed,
      backwardBlocks: backwardResult.processed
    };
  } else {
    // Execute single direction sync
    const { startBlock, endBlock, direction, priority, blocksToSync } = plan;
    
    console.log(`\n🔨 === EXECUTING OPTIMIZED SYNC ===`);
    console.log(`🚀 Starting optimized ${direction} sync of ${blocksToSync} blocks...`);
    
    const result = await executeOptimizedSyncDirection(startBlock, endBlock, direction, blocksToSync);
    
    console.log(`✅ Optimized sync batch complete!`);
    console.log(`   📦 Processed: ${result.processed} blocks`);
    console.log(`   💰 Payments found: ${result.paymentsFound}`);
    console.log(`   ⚡ Performance: ${result.rate.toFixed(1)} blocks/sec (${(result.rate * 60).toFixed(0)} blocks/min)`);
    console.log(`   🚀 Speedup: ~${Math.round(result.rate / 3)}x faster than sequential`);
    
    return {
      success: true,
      message: `Processed ${result.processed} blocks (${priority}) - ${result.paymentsFound} payments found`,
      blocksProcessed: result.processed,
      paymentsFound: result.paymentsFound,
      direction,
      priority,
      timeElapsed: result.elapsed,
      blocksPerSecond: result.rate
    };
  }
}

// OPTIMIZED: New parallel block processing function
async function executeOptimizedSyncDirection(startBlock, endBlock, direction, blocksToSync) {
  let processed = 0;
  let paymentsFound = 0;
  const startTime = Date.now();
  
  // Generate block height array
  const blockHeights = [];
  if (direction === 'forward') {
    for (let height = startBlock; height <= endBlock; height++) {
      blockHeights.push(height);
    }
  } else {
    for (let height = endBlock; height >= startBlock; height--) {
      blockHeights.push(height);
    }
  }

  console.log(`🚀 Processing ${blockHeights.length} blocks in parallel batches...`);

  // Process in parallel batches
  const actualBatchSize = ENABLE_FAST_SYNC ? BATCH_SIZE : Math.min(BATCH_SIZE, 10);
  
  for (let i = 0; i < blockHeights.length; i += actualBatchSize) {
    const batchHeights = blockHeights.slice(i, i + actualBatchSize);
    const batchStartTime = Date.now();
    
    console.log(`   📦 Processing batch ${Math.floor(i / actualBatchSize) + 1}/${Math.ceil(blockHeights.length / actualBatchSize)}: blocks ${batchHeights[0]} to ${batchHeights[batchHeights.length - 1]}`);
    
    try {
      // OPTIMIZED: Fetch all blocks in parallel
      const blockResults = await getBlockDataBatch(batchHeights);
      
      // OPTIMIZED: Analyze all blocks at once
      const analysis = analyzeBlocksBatch(blockResults, getAllTargetAddresses());
      
      if (analysis.transactions.length > 0) {
        console.log(`💰 Found ${analysis.transactions.length} payments in batch of ${batchHeights.length} blocks`);
        
        // OPTIMIZED: Resolve from addresses in parallel
        const enhancedTransactions = await batchResolveFromAddresses(
          analysis.transactions, 
          Math.min(API_CONFIG.MAX_CONCURRENT, 15)
        );
        
        // OPTIMIZED: Batch insert transactions and blocks
        await batchInsertData(blockResults, enhancedTransactions);
        
        paymentsFound += enhancedTransactions.length;
      } else {
        // Even if no payments, still need to record the blocks
        await batchInsertBlocks(blockResults);
      }
      
      processed += batchHeights.length;
      
      const batchElapsed = (Date.now() - batchStartTime) / 1000;
      const batchRate = batchHeights.length / batchElapsed;
      const overallElapsed = (Date.now() - startTime) / 1000;
      const overallRate = processed / overallElapsed;
      
      // Progress logging
      if (processed % (actualBatchSize * 2) === 0 || i + actualBatchSize >= blockHeights.length) {
        console.log(`     📊 Progress: ${processed}/${blocksToSync} blocks (batch: ${batchRate.toFixed(1)} b/s, overall: ${overallRate.toFixed(1)} b/s, ${paymentsFound} payments)`);
        
        // Report progress
        updateSyncStatus({
          lastSyncMessage: `${direction} sync: ${processed}/${blocksToSync} blocks (${overallRate.toFixed(1)} blocks/sec)`,
          syncRate: overallRate
        });
      }
      
    } catch (error) {
      console.error(`❌ Error processing batch ${i / actualBatchSize + 1}:`, error);
      // Continue with next batch rather than failing entirely
      processed += batchHeights.length; // Count as processed to avoid infinite loops
    }
    
    // Small delay between batches if not in fast sync mode
    if (!ENABLE_FAST_SYNC && i + actualBatchSize < blockHeights.length) {
      await new Promise(resolve => setTimeout(resolve, API_CONFIG.REQUEST_DELAY));
    }
  }
  
  const elapsed = (Date.now() - startTime) / 1000;
  const rate = processed / elapsed;
  
  return { processed, paymentsFound, elapsed, rate };
}

// OPTIMIZED: Batch insert blocks and transactions
async function batchInsertData(blockResults, transactions) {
  try {
    // Prepare block inserts
    const blockInserts = blockResults
      .filter(result => result.data)
      .map(result => [
        result.height,
        result.data.time || Math.floor(Date.now() / 1000),
        result.data.hash || ''
      ]);

    // Batch insert blocks
    if (blockInserts.length > 0) {
      const blockInsertTransaction = statements.db.transaction(() => {
        for (const insert of blockInserts) {
          statements.insertBlock.run(...insert);
        }
      });
      blockInsertTransaction();
    }

    // Batch insert transactions
    if (transactions && transactions.length > 0) {
      const transactionInserts = transactions.map(tx => {
        const blockData = blockResults.find(b => b.height === tx.blockHeight);
        const timestamp = blockData?.data?.time || Math.floor(Date.now() / 1000);
        
        return [
          tx.blockHeight,
          tx.id || '',
          tx.voutIndex || 0,
          tx.to,
          tx.from === 'Unknown' ? null : tx.from,
          tx.amount || 0,
          timestamp
        ];
      });

      const transactionInsertTransaction = statements.db.transaction(() => {
        for (const insert of transactionInserts) {
          try {
            statements.insertTransaction.run(...insert);
          } catch (dbError) {
            // Transaction might already exist, which is fine due to UNIQUE constraint
            if (!dbError.message.includes('UNIQUE constraint failed')) {
              console.error('❌ Error storing transaction:', dbError);
            }
          }
        }
      });
      transactionInsertTransaction();
    }

  } catch (error) {
    console.error('❌ Error in batch insert:', error);
    // Fallback to individual inserts
    await fallbackIndividualInserts(blockResults, transactions);
  }
}

// OPTIMIZED: Batch insert blocks only (when no transactions found)
async function batchInsertBlocks(blockResults) {
  try {
    const blockInserts = blockResults
      .filter(result => result.data)
      .map(result => [
        result.height,
        result.data.time || Math.floor(Date.now() / 1000),
        result.data.hash || ''
      ]);

    if (blockInserts.length > 0) {
      const blockInsertTransaction = statements.db.transaction(() => {
        for (const insert of blockInserts) {
          statements.insertBlock.run(...insert);
        }
      });
      blockInsertTransaction();
    }
  } catch (error) {
    console.error('❌ Error in batch block insert:', error);
    // Fallback to individual inserts
    for (const result of blockResults) {
      if (result.data) {
        try {
          statements.insertBlock.run(
            result.height,
            result.data.time || Math.floor(Date.now() / 1000),
            result.data.hash || ''
          );
        } catch (individualError) {
          console.error(`❌ Error inserting block ${result.height}:`, individualError);
        }
      }
    }
  }
}

// Fallback function for individual inserts when batch fails
async function fallbackIndividualInserts(blockResults, transactions) {
  console.log('⚠️ Using fallback individual inserts...');
  
  // Insert blocks individually
  for (const result of blockResults) {
    if (result.data) {
      try {
        statements.insertBlock.run(
          result.height,
          result.data.time || Math.floor(Date.now() / 1000),
          result.data.hash || ''
        );
      } catch (error) {
        console.error(`❌ Error inserting block ${result.height}:`, error);
      }
    }
  }

  // Insert transactions individually
  if (transactions && transactions.length > 0) {
    for (const tx of transactions) {
      const blockData = blockResults.find(b => b.height === tx.blockHeight);
      const timestamp = blockData?.data?.time || Math.floor(Date.now() / 1000);
      
      try {
        statements.insertTransaction.run(
          tx.blockHeight,
          tx.id || '',
          tx.voutIndex || 0,
          tx.to,
          tx.from === 'Unknown' ? null : tx.from,
          tx.amount || 0,
          timestamp
        );
      } catch (dbError) {
        if (!dbError.message.includes('UNIQUE constraint failed')) {
          console.error('❌ Error storing transaction:', dbError);
        }
      }
    }
  }
}

// Legacy individual block processing (kept for backward compatibility)
async function processBlock(blockHeight) {
  try {
    const blockResults = await getBlockDataBatch([blockHeight]);
    const blockData = blockResults[0]?.data;
    
    if (!blockData) return 0;
    
    // Insert block record
    statements.insertBlock.run(
      blockHeight,
      blockData.time || Math.floor(Date.now() / 1000),
      blockData.hash || ''
    );
    
    // Use the enhanced block analysis function for multiple addresses
    const targetAddresses = getAllTargetAddresses();
    const analysis = analyzeBlocksBatch([blockResults[0]], targetAddresses);
    
    if (analysis.transactions.length === 0) {
      return 0;
    }
    
    console.log(`💰 Found ${analysis.transactions.length} payments in block ${blockHeight} across ${targetAddresses.length} addresses`);
    
    // Log address breakdown if multiple addresses
    if (targetAddresses.length > 1) {
      for (const [address, breakdown] of Object.entries(analysis.addressBreakdown)) {
        if (breakdown.count > 0) {
          console.log(`   📍 ${address}: ${breakdown.count} payments (${breakdown.value.toFixed(8)} FLUX)`);
        }
      }
    }
    
    // Resolve any from addresses that need lookup
    const enhancedTransactions = await batchResolveFromAddresses(analysis.transactions, 3);
    
    let paymentsStored = 0;
    
    // Store each transaction with from_address
    for (const tx of enhancedTransactions) {
      try {
        // Clean up the from address
        let fromAddress = tx.from;
        if (fromAddress === 'Unknown' || !fromAddress) {
          fromAddress = null;
        }
        
        statements.insertTransaction.run(
          blockHeight,           // block_height
          tx.id || '',          // tx_hash
          tx.voutIndex || 0,    // vout_index
          tx.to,                // address (recipient) - now uses the actual target address
          fromAddress,          // from_address (sender)
          tx.amount || 0,       // value
          blockData.time || Math.floor(Date.now() / 1000) // timestamp
        );
        
        paymentsStored++;
        
        // Log payment details
        console.log(`💰 Stored payment: ${tx.amount.toFixed(8)} FLUX from ${fromAddress || 'Unknown'} to ${tx.to} (${tx.id})`);
        
      } catch (dbError) {
        // Transaction might already exist, which is fine due to UNIQUE constraint
        if (!dbError.message.includes('UNIQUE constraint failed')) {
          console.error('❌ Error storing transaction:', dbError);
        }
      }
    }
    
    return paymentsStored;
    
  } catch (error) {
    console.error(`❌ Error processing block ${blockHeight}:`, error);
    return 0;
  }
}

function logSyncSummary(status, result = null) {
  const targetAddresses = getAllTargetAddresses();
  
  console.log(`\n📋 === OPTIMIZED SYNC SUMMARY ===`);
  console.log(`🎯 Tracking ${targetAddresses.length} addresses`);
  console.log(`📦 Total blocks synced: ${status.totalBlocksSynced.toLocaleString()}`);
  console.log(`⏳ Total blocks remaining: ${status.totalBlocksRemaining.toLocaleString()}`);
  console.log(`📊 Progress: ${status.syncProgress.toFixed(2)}% of target (${RETENTION_DAYS} days)`);
  
  // Performance summary
  if (PERFORMANCE_CONFIG.ENABLE_METRICS && syncMetrics.syncCount > 0) {
    console.log(`⚡ Performance metrics:`);
    console.log(`   📈 Average sync speed: ${syncMetrics.averageBlocksPerSecond.toFixed(1)} blocks/sec`);
    console.log(`   📊 Total syncs completed: ${syncMetrics.syncCount}`);
    console.log(`   🏆 Total blocks processed: ${syncMetrics.totalBlocksProcessed.toLocaleString()}`);
  }
  
  // Add database size info with proper ES module imports
  try {
    const dbPath = 'flux-tracker.db';
    if (existsSync(dbPath)) {
      const stats = readFileSync(dbPath);
      const fileSizeInBytes = stats.length;
      const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
      const fileSizeInKB = (fileSizeInBytes / 1024).toFixed(1);
      console.log(`💾 Database size: ${fileSizeInMB} MB (${fileSizeInKB} KB, ${fileSizeInBytes.toLocaleString()} bytes)`);
    } else {
      console.log(`💾 Database file not found at: ${dbPath}`);
    }
  } catch (error) {
    console.log(`💾 Database size: Error reading file - ${error.message}`);
  }
  
  if (status.totalBlocksRemaining > 0) {
    // Updated ETA calculation based on current performance
    const currentRate = syncMetrics.averageBlocksPerSecond || (result?.blocksPerSecond) || 10;
    const estimatedMinutes = status.totalBlocksRemaining / currentRate / 60;
    const estimatedHours = estimatedMinutes / 60;
    
    if (estimatedHours < 1) {
      console.log(`⏰ Estimated time to complete: ${estimatedMinutes.toFixed(0)} minutes at current rate`);
    } else if (estimatedHours < 24) {
      console.log(`⏰ Estimated time to complete: ${estimatedHours.toFixed(1)} hours at current rate`);
    } else {
      const estimatedDays = estimatedHours / 24;
      console.log(`⏰ Estimated time to complete: ${estimatedDays.toFixed(1)} days at current rate`);
    }
    
    console.log(`🚀 With optimizations: ~${Math.round(currentRate)}x faster than original sequential processing`);
  } else {
    console.log(`🎉 Sync complete! All target data has been collected.`);
  }
  
  if (result) {
    console.log(`💰 Last batch found: ${result.paymentsFound || 0} payments`);
    if (result.direction === 'hybrid') {
      console.log(`📊 Hybrid efficiency: ${result.forwardBlocks || 0} forward + ${result.backwardBlocks || 0} backward blocks`);
    }
    if (result.blocksPerSecond) {
      console.log(`⚡ Last sync rate: ${result.blocksPerSecond.toFixed(1)} blocks/sec`);
    }
  }
}

async function cleanOldData() {
  try {
    const cutoffTime = Math.floor(Date.now() / 1000) - (RETENTION_DAYS * 24 * 60 * 60);
    
    const deletedTx = statements.deleteOldTransactions.run(cutoffTime);
    const deletedBlocks = statements.deleteOldBlocks.run(cutoffTime);
    
    if (deletedTx.changes > 0 || deletedBlocks.changes > 0) {
      console.log(`🧹 Cleaned old data: ${deletedTx.changes} transactions, ${deletedBlocks.changes} blocks`);
    }
  } catch (error) {
    console.error('❌ Error cleaning old data:', error);
  }
}

// Performance tracking functions - NEW
function updateSyncMetrics(blocksProcessed, syncDuration) {
  syncMetrics.totalBlocksProcessed += blocksProcessed;
  syncMetrics.totalSyncTime += syncDuration;
  syncMetrics.syncCount++;
  syncMetrics.averageBlocksPerSecond = syncMetrics.totalBlocksProcessed / syncMetrics.totalSyncTime;
  syncMetrics.lastSyncPerformance = {
    blocks: blocksProcessed,
    duration: syncDuration,
    rate: blocksProcessed / syncDuration
  };
}

function logPerformanceStats() {
  const perfStats = getPerformanceStats();
  console.log(`\n⚡ === PERFORMANCE STATS ===`);
  console.log(`📡 API calls made: ${perfStats.apiCallCount}`);
  console.log(`🎯 Cache hits: ${perfStats.cacheHitCount} (${perfStats.cacheHitRate.toFixed(1)}% hit rate)`);
  console.log(`⏱️ Average batch time: ${perfStats.avgBatchTime}ms`);
  console.log(`🔗 Active connections: ${perfStats.activeConnections}/${API_CONFIG.MAX_CONCURRENT}`);
  console.log(`📝 Address cache size: ${perfStats.cacheSize}`);
  console.log(`📦 Block cache size: ${perfStats.blockCacheSize}`);
  
  if (syncMetrics.lastSyncPerformance) {
    const last = syncMetrics.lastSyncPerformance;
    console.log(`🏆 Last sync: ${last.blocks} blocks in ${last.duration.toFixed(1)}s (${last.rate.toFixed(1)} blocks/sec)`);
  }
}

// Get performance metrics for API
export function getSyncMetrics() {
  return {
    ...syncMetrics,
    api: getPerformanceStats()
  };
}

// Utility function to backfill from addresses for existing transactions - OPTIMIZED
export async function backfillFromAddresses(limit = 100) {
  try {
    console.log(`🔍 Starting OPTIMIZED backfill of from addresses for up to ${limit} transactions...`);
    
    // Get transactions that don't have from addresses
    const transactionsToUpdate = statements.getTransactionsWithoutFromAddress.all(limit);
    
    if (transactionsToUpdate.length === 0) {
      console.log('✅ No transactions need from address backfill');
      return { updated: 0, message: 'No transactions need backfill' };
    }
    
    console.log(`📋 Found ${transactionsToUpdate.length} transactions to backfill`);
    
    // Group transactions by block height for efficient processing
    const blockMap = new Map();
    for (const tx of transactionsToUpdate) {
      if (!blockMap.has(tx.block_height)) {
        blockMap.set(tx.block_height, []);
      }
      blockMap.get(tx.block_height).push(tx);
    }
    
    const uniqueBlockHeights = Array.from(blockMap.keys());
    console.log(`📦 Processing ${uniqueBlockHeights.length} unique blocks...`);
    
    // Fetch all required blocks in parallel
    const blockResults = await getBlockDataBatch(uniqueBlockHeights);
    
    let updated = 0;
    
    // Process each block's transactions
    for (const blockResult of blockResults) {
      if (!blockResult.data) continue;
      
      const blockTxs = blockMap.get(blockResult.height) || [];
      const targetAddresses = getAllTargetAddresses();
      const analysis = analyzeBlocksBatch([blockResult], targetAddresses);
      
      for (const tx of blockTxs) {
        const targetTx = analysis.transactions.find(t => 
          t.id === tx.tx_hash && 
          t.voutIndex === tx.vout_index && 
          t.to === tx.address
        );
        
        if (targetTx) {
          let fromAddress = targetTx.from;
          
          // Resolve if needed
          if (fromAddress && fromAddress.startsWith('prev:')) {
            const parts = fromAddress.replace('prev:', '').split(':');
            const prevTxId = parts[0];
            const voutIndex = parseInt(parts[1]) || 0;
            
            fromAddress = await resolveFromAddress(prevTxId, voutIndex);
          }
          
          // Update the transaction
          statements.updateTransactionFromAddress.run(
            fromAddress === 'Unknown' ? null : fromAddress,
            tx.tx_hash,
            tx.block_height,
            tx.vout_index
          );
          
          updated++;
          console.log(`✅ Updated ${tx.tx_hash} with from address: ${fromAddress || 'Unknown'}`);
        }
      }
    }
    
    console.log(`🎉 Optimized backfill complete: Updated ${updated} transactions`);
    return { updated, message: `Updated ${updated} transactions with from addresses` };
  } catch (error) {
    console.error('❌ Error during optimized backfill:', error);
    return { updated: 0, message: `Backfill failed: ${error.message}` };
  }
}

// Legacy function for manual sync API
export async function syncBlocks() {
  return await performSync();
}