// src/routes/api/network-stats-history/+server.js
import { json } from '@sveltejs/kit';
import { dbUtils } from '../../../lib/db.js';
import { collectNetworkStatsSnapshot, getNetworkStatsCollectionStatus } from '../../../lib/flux-api.js';

export async function GET({ url }) {
  try {
    const params = url.searchParams;
    
    // Parse query parameters
    const startDate = params.get('start_date');
    const endDate = params.get('end_date');
    const type = params.get('type') || 'both'; // 'node', 'utilization', or 'both'
    const period = params.get('period') || '30d'; // '7d', '30d', '90d', '1y', 'all'
    const action = params.get('action'); // 'collect' to trigger manual collection
    
    // Handle manual collection trigger
    if (action === 'collect') {
      console.log('🚀 Manual network stats collection triggered via API');
      const collectionResult = await collectNetworkStatsSnapshot(true);
      
      return json({
        success: true,
        action: 'manual_collection',
        result: collectionResult,
        message: collectionResult.success ? 
          'Network stats collected successfully' : 
          'Network stats collection failed',
        timestamp: new Date().toISOString()
      });
    }
    
    // Calculate date range based on period if not provided
    let calculatedStartDate, calculatedEndDate;
    
    if (startDate && endDate) {
      calculatedStartDate = startDate;
      calculatedEndDate = endDate;
    } else {
      calculatedEndDate = new Date().toISOString().split('T')[0];
      const endDateObj = new Date(calculatedEndDate);
      
      switch (period) {
        case '7d':
          calculatedStartDate = new Date(endDateObj - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '30d':
          calculatedStartDate = new Date(endDateObj - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '90d':
          calculatedStartDate = new Date(endDateObj - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case '1y':
          calculatedStartDate = new Date(endDateObj - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          break;
        case 'all':
          calculatedStartDate = '2020-01-01'; // Far enough back to get all data
          break;
        default:
          calculatedStartDate = new Date(endDateObj - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }
    }
    
    console.log(`📊 Fetching network stats history: ${calculatedStartDate} to ${calculatedEndDate} (type: ${type})`);
    
    // Fetch historical data
    const historyData = dbUtils.getNetworkStatsHistory(calculatedStartDate, calculatedEndDate, type);
    
    // Get current collection status
    const collectionStatus = getNetworkStatsCollectionStatus();
    
    // Get health information
    const healthInfo = dbUtils.getNetworkStatsHealth();
    
    // Process and format the data
    const processedData = {
      query: {
        start_date: calculatedStartDate,
        end_date: calculatedEndDate,
        type,
        period,
        requested_at: new Date().toISOString()
      },
      
      collection_status: {
        is_running: collectionStatus.isRunning,
        is_scheduled: collectionStatus.isScheduled,
        last_collection: collectionStatus.lastCollectionTime ? 
          new Date(collectionStatus.lastCollectionTime).toISOString() : null,
        last_success: collectionStatus.lastSuccessTime ? 
          new Date(collectionStatus.lastSuccessTime).toISOString() : null,
        next_collection: collectionStatus.nextScheduledCollection ? 
          collectionStatus.nextScheduledCollection.toISOString() : null,
        consecutive_failures: collectionStatus.consecutiveFailures
      },
      
      health: healthInfo,
      
      data: {
        node_stats: [],
        utilization_stats: [],
        summary: {
          total_node_snapshots: 0,
          total_utilization_snapshots: 0,
          date_range_days: Math.ceil((new Date(calculatedEndDate) - new Date(calculatedStartDate)) / (24 * 60 * 60 * 1000)),
          api_success_rate: 0
        }
      }
    };
    
    // Process node stats if requested
    if ((type === 'node' || type === 'both') && historyData.nodeStats) {
      processedData.data.node_stats = historyData.nodeStats.map(row => ({
        timestamp: row.timestamp,
        date: new Date(row.timestamp * 1000).toISOString(),
        total_nodes: row.total_nodes,
        cumulus_nodes: row.cumulus_nodes,
        nimbus_nodes: row.nimbus_nodes,
        stratus_nodes: row.stratus_nodes,
        arcane_nodes: row.arcane_nodes,
        arcane_percentage: row.arcane_percentage,
        cumulus_percentage: row.cumulus_percentage,
        nimbus_percentage: row.nimbus_percentage,
        stratus_percentage: row.stratus_percentage,
        data_source: row.data_source,
        api_success_rate: row.api_success_rate,
        notes: row.notes
      }));
      
      processedData.data.summary.total_node_snapshots = historyData.nodeStats.length;
    }
    
    // Process utilization stats if requested
    if ((type === 'utilization' || type === 'both') && historyData.utilizationStats) {
      processedData.data.utilization_stats = historyData.utilizationStats.map(row => ({
        timestamp: row.timestamp,
        date: new Date(row.timestamp * 1000).toISOString(),
        total_cores: row.total_cores,
        total_ram_gb: row.total_ram_gb,
        total_ssd_gb: row.total_ssd_gb,
        utilized_cores: row.utilized_cores,
        utilized_nodes: row.utilized_nodes,
        utilized_ram_gb: row.utilized_ram_gb,
        utilized_ssd_gb: row.utilized_ssd_gb,
        cores_percentage: row.cores_percentage,
        nodes_percentage: row.nodes_percentage,
        ram_percentage: row.ram_percentage,
        ssd_percentage: row.ssd_percentage,
        running_apps: row.running_apps,
        nodes_with_apps: row.nodes_with_apps,
        watchtower_instances: row.watchtower_instances,
        total_checked_nodes: row.total_checked_nodes,
        data_source: row.data_source,
        api_success_rate: row.api_success_rate,
        notes: row.notes
      }));
      
      processedData.data.summary.total_utilization_snapshots = historyData.utilizationStats.length;
    }
    
    // Calculate average API success rate
    const allSnapshots = [...(historyData.nodeStats || []), ...(historyData.utilizationStats || [])];
    if (allSnapshots.length > 0) {
      processedData.data.summary.api_success_rate = 
        allSnapshots.reduce((sum, snapshot) => sum + (snapshot.api_success_rate || 0), 0) / allSnapshots.length;
    }
    
    console.log(`✅ Retrieved ${processedData.data.summary.total_node_snapshots} node stats and ${processedData.data.summary.total_utilization_snapshots} utilization stats`);
    
    return json(processedData);
    
  } catch (error) {
    console.error('❌ Network stats history API error:', error);
    
    return json({
      error: {
        message: error.message,
        type: 'network_stats_history_error',
        timestamp: new Date().toISOString()
      },
      query: {
        start_date: null,
        end_date: null,
        type: 'unknown',
        period: 'unknown'
      },
      collection_status: {
        is_running: false,
        is_scheduled: false,
        error: 'Unable to determine status'
      },
      health: null,
      data: {
        node_stats: [],
        utilization_stats: [],
        summary: {
          total_node_snapshots: 0,
          total_utilization_snapshots: 0,
          date_range_days: 0,
          api_success_rate: 0
        }
      }
    }, { status: 500 });
  }
}

// POST endpoint for manual operations
export async function POST({ request }) {
  try {
    const body = await request.json();
    const { action, force } = body;
    
    switch (action) {
      case 'collect':
        console.log('🚀 Manual network stats collection triggered via POST');
        const collectionResult = await collectNetworkStatsSnapshot(force === true);
        
        return json({
          success: collectionResult.success,
          action: 'manual_collection',
          result: collectionResult,
          message: collectionResult.success ? 
            'Network stats collected successfully' : 
            'Network stats collection failed',
          timestamp: new Date().toISOString()
        });
        
      case 'cleanup':
        console.log('🧹 Manual network stats cleanup triggered via POST');
        const cleanupResult = dbUtils.cleanupOldNetworkStats();
        
        return json({
          success: cleanupResult.nodeStatsDeleted >= 0 && cleanupResult.utilizationStatsDeleted >= 0,
          action: 'cleanup',
          result: cleanupResult,
          message: `Cleaned up ${cleanupResult.nodeStatsDeleted} node stats and ${cleanupResult.utilizationStatsDeleted} utilization stats`,
          timestamp: new Date().toISOString()
        });
        
      case 'health':
        console.log('🏥 Network stats health check triggered via POST');
        const healthResult = dbUtils.getNetworkStatsHealth();
        
        return json({
          success: true,
          action: 'health_check',
          result: healthResult,
          message: 'Health check completed',
          timestamp: new Date().toISOString()
        });
        
      default:
        return json({
          success: false,
          error: `Unknown action: ${action}`,
          available_actions: ['collect', 'cleanup', 'health'],
          timestamp: new Date().toISOString()
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Network stats history POST error:', error);
    
    return json({
      success: false,
      error: {
        message: error.message,
        type: 'network_stats_post_error',
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}