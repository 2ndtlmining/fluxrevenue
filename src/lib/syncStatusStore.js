// syncStatusStore.js - Centralized sync status management

let syncInfo = {
  isRunning: false,
  lastSyncTime: null,
  lastSyncMessage: 'Not started',
  syncRate: 0,
  blocksProcessed: 0,
  totalBlocks: 0,
  progress: 0
};

export function updateSyncInfo(updates) {
  syncInfo = { ...syncInfo, ...updates };
  
  // Emit to any listeners (could be WebSocket connections, etc.)
  if (typeof process !== 'undefined' && process.emit) {
    process.emit('syncStatusUpdate', syncInfo);
  }
}

export function getSyncInfo() {
  return { ...syncInfo };
}

export function resetSyncInfo() {
  syncInfo = {
    isRunning: false,
    lastSyncTime: null,
    lastSyncMessage: 'Reset',
    syncRate: 0,
    blocksProcessed: 0,
    totalBlocks: 0,
    progress: 0
  };
}