import { json } from '@sveltejs/kit';
import { getAllBalances, getCombinedNodeStats, getNetworkUtilizationStats } from '../../../lib/flux-api.js';
import { getAllTargetAddresses } from '../../../lib/config.js';
import { dbUtils } from '../../../lib/db.js';

export async function GET() {
  try {
    const [balances, nodeStats, utilizationStats] = await Promise.all([
      getAllBalances(),
      getCombinedNodeStats(),
      getNetworkUtilizationStats()
    ]);
    
    const targetAddresses = getAllTargetAddresses();
    
    // Calculate total balance across all addresses
    const totalBalance = Object.values(balances).reduce((sum, balance) => sum + balance, 0);
    
    // Create address breakdown
    const addressBreakdown = targetAddresses.map(address => ({
      address,
      balance: balances[address] || 0,
      percentage: totalBalance > 0 ? ((balances[address] || 0) / totalBalance * 100).toFixed(2) : '0.00'
    }));
    
    // NEW: Get network stats health and recent history
    const networkStatsHealth = dbUtils.getNetworkStatsHealth();
    const shouldCollectSnapshot = dbUtils.shouldTakeNetworkSnapshot();
    
    return json({
      // Legacy fields for backward compatibility
      balance: totalBalance,
      
      // New multi-address fields
      addresses: {
        total_balance: totalBalance,
        count: targetAddresses.length,
        breakdown: addressBreakdown,
        individual_balances: balances
      },
      
      // Node statistics
      node_stats: {
        total: nodeStats.total,
        cumulus: nodeStats.cumulus,
        nimbus: nodeStats.nimbus,
        stratus: nodeStats.stratus,
        arcane_nodes: nodeStats.arcane_nodes,
        arcane_percentage: nodeStats.arcane_percentage,
        cumulus_percentage: nodeStats.cumulus_percentage,
        nimbus_percentage: nodeStats.nimbus_percentage,
        stratus_percentage: nodeStats.stratus_percentage,
        last_updated: nodeStats.last_updated
      },
      
      // Network utilization statistics - FIXED: Now includes running_apps
      network_utilization: {
        total: {
          cores: utilizationStats.total.cores,
          ram: utilizationStats.total.ram,
          ssd: utilizationStats.total.ssd
        },
        utilized: {
          cores: utilizationStats.utilized.cores,
          nodes: utilizationStats.utilized.nodes,
          ram: utilizationStats.utilized.ram,
          ssd: utilizationStats.utilized.ssd,
          cores_percentage: utilizationStats.utilized.cores_percentage,
          nodes_percentage: utilizationStats.utilized.nodes_percentage,
          ram_percentage: utilizationStats.utilized.ram_percentage,
          ssd_percentage: utilizationStats.utilized.ssd_percentage
        },
        // FIXED: Added the missing running_apps data
        running_apps: {
          total_apps: utilizationStats.running_apps?.total_apps || 0,
          nodes_with_apps: utilizationStats.running_apps?.nodes_with_apps || 0,
          watchtower_instances: utilizationStats.running_apps?.watchtower_instances || 0
        },
        total_nodes: utilizationStats.total_nodes,
        last_updated: utilizationStats.last_updated
      },
      
      // NEW: Network stats collection status and health
      network_stats_collection: {
        health: networkStatsHealth,
        should_collect_snapshot: shouldCollectSnapshot,
        collection_status: 'automated', // Always automated now
        next_collection_info: shouldCollectSnapshot.should ? 
          `Ready for collection` : shouldCollectSnapshot.reason
      },
      
      // Metadata
      last_updated: new Date().toISOString(),
      tracked_addresses: targetAddresses
    });
    
  } catch (error) {
    console.error('Stats API error:', error);
    return json({ 
      error: error.message,
      // Fallback data
      balance: 0,
      addresses: {
        total_balance: 0,
        count: 0,
        breakdown: [],
        individual_balances: {}
      },
      node_stats: {
        total: 0,
        cumulus: 0,
        nimbus: 0,
        stratus: 0,
        arcane_nodes: 0,
        arcane_percentage: 0,
        cumulus_percentage: 0,
        nimbus_percentage: 0,
        stratus_percentage: 0,
        last_updated: null
      },
      // FIXED: Added running_apps to fallback data too
      network_utilization: {
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
      },
      network_stats_collection: {
        health: null,
        should_collect_snapshot: { should: false, reason: 'Error occurred' },
        collection_status: 'error',
        next_collection_info: 'Error occurred'
      }
    }, { status: 500 });
  }
}