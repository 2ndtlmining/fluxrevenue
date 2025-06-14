// /api/sync-status/+server.js
import { json } from '@sveltejs/kit';
import { statements } from '$lib/db.js';
import { getCurrentBlockHeight } from '$lib/flux-api.js';
import { getSyncInfo } from '$lib/syncStatusStore.js'; // FIXED: Correct function name

const BLOCKS_PER_DAY = 720;
const RETENTION_DAYS = 365;
const MAX_BLOCKS_PER_SYNC = 100;
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes - matches scheduler interval

export async function GET() {
  try {
    // Get current network height
    const currentHeight = await getCurrentBlockHeight();
    if (!currentHeight) {
      return json({ 
        error: 'Unable to fetch network height',
        isOnline: false 
      }, { status: 503 });
    }

    // Get database sync status
    const syncStatus = getSyncStatus(currentHeight);
    if (!syncStatus) {
      return json({ 
        error: 'Database not ready',
        isOnline: false 
      }, { status: 503 });
    }

    // Get sync info from shared store - FIXED: Using correct function name
    const lastSyncInfo = getSyncInfo();

    // Calculate estimated time remaining
    const estimatedTimeRemaining = calculateETA(syncStatus, lastSyncInfo);

    // Determine if sync is currently active
    const isCurrentlyOnline = isSystemOnline(lastSyncInfo);

    const response = {
      // Current status
      currentHeight: syncStatus.currentHeight,
      highestSynced: syncStatus.highestSynced,
      lowestSynced: syncStatus.lowestSynced,
      
      // Progress info
      totalBlocksSynced: syncStatus.totalBlocksSynced,
      totalBlocksRemaining: syncStatus.totalBlocksRemaining,
      newBlocksRemaining: syncStatus.newBlocksRemaining,
      historicalBlocksRemaining: syncStatus.historicalBlocksRemaining,
      syncProgress: syncStatus.syncProgress,
      
      // Status indicators
      isOnline: isCurrentlyOnline,
      isFirstRun: syncStatus.isFirstRun,
      hasCompletedInitialSync: syncStatus.hasCompletedInitialSync,
      
      // Timing info
      estimatedTimeRemaining,
      lastSyncTime: lastSyncInfo.lastSyncTime,
      lastSyncMessage: lastSyncInfo.lastSyncMessage,
      syncRate: lastSyncInfo.syncRate || 0,
      
      // Debug info
      needsForwardSync: syncStatus.needsForwardSync,
      needsBackwardSync: syncStatus.needsBackwardSync,
      targetLowestBlock: syncStatus.targetLowestBlock
    };

    return json(response);

  } catch (error) {
    console.error('Error in sync-status API:', error);
    return json({ 
      error: 'Internal server error',
      isOnline: false,
      message: error.message 
    }, { status: 500 });
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
    
    // Calculate remaining blocks - ensure we don't return negative values
    const newBlocksRemaining = highestSynced ? Math.max(0, currentHeight - highestSynced) : BLOCKS_PER_DAY;
    const historicalBlocksRemaining = lowestSynced ? Math.max(0, lowestSynced - targetLowestBlock) : Math.max(0, (BLOCKS_PER_DAY * RETENTION_DAYS) - BLOCKS_PER_DAY);
    const totalBlocksRemaining = newBlocksRemaining + historicalBlocksRemaining;
    
    // Calculate progress as a percentage of target blocks (not just synced blocks)
    const targetTotalBlocks = BLOCKS_PER_DAY * RETENTION_DAYS;
    const syncProgress = Math.min(100, Math.max(0, (totalBlocksSynced / targetTotalBlocks) * 100));
    
    return {
      currentHeight,
      totalBlocksSynced: Math.max(0, totalBlocksSynced), // Ensure never negative
      highestSynced: highestSynced || 0, // Default to 0 instead of null
      lowestSynced: lowestSynced || 0, // Default to 0 instead of null
      targetLowestBlock,
      initialSyncTarget,
      newBlocksRemaining: Math.max(0, newBlocksRemaining),
      historicalBlocksRemaining: Math.max(0, historicalBlocksRemaining),
      totalBlocksRemaining: Math.max(0, totalBlocksRemaining),
      isFirstRun: highestSynced === null,
      needsForwardSync: highestSynced === null || highestSynced < currentHeight,
      needsBackwardSync: lowestSynced === null || lowestSynced > targetLowestBlock,
      hasCompletedInitialSync: lowestSynced !== null && lowestSynced <= initialSyncTarget,
      syncProgress: syncProgress
    };
  } catch (error) {
    console.error('❌ Error getting sync status:', error);
    return null;
  }
}

function calculateETA(syncStatus, lastSyncInfo) {
  if (!syncStatus || syncStatus.totalBlocksRemaining <= 0) return null;
  
  // Estimate based on current sync rate or default rate
  const blocksPerMinute = lastSyncInfo.syncRate 
    ? (lastSyncInfo.syncRate * 60) 
    : (MAX_BLOCKS_PER_SYNC / (SYNC_INTERVAL / 1000 / 60)); // Default rate
  
  if (blocksPerMinute <= 0) return null;
  
  const estimatedMinutes = syncStatus.totalBlocksRemaining / blocksPerMinute;
  return Math.max(1, Math.round(estimatedMinutes));
}

function isSystemOnline(syncInfo) {
  if (!syncInfo.lastSyncTime) return false;
  
  // Consider system online if last sync was within 2 sync intervals
  const maxOfflineTime = SYNC_INTERVAL * 2;
  const timeSinceLastSync = Date.now() - syncInfo.lastSyncTime;
  
  return timeSinceLastSync < maxOfflineTime || syncInfo.isRunning;
}