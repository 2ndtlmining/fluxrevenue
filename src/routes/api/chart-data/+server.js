import { json } from '@sveltejs/kit';

// Import the database connection directly
let db;
try {
  const dbModule = await import('$lib/db.js');
  db = dbModule.db;
  console.log('✅ Database imported successfully');
} catch (error) {
  console.error('❌ Failed to import database:', error);
}

export async function GET({ url }) {
  const source = url.searchParams.get('source') || 'transactions';
  const metric = url.searchParams.get('metric') || 'revenue';
  const range = url.searchParams.get('range') || '30d';

  console.log(`📊 Chart API called: ${source}/${metric}/${range}`);

  // First, test if database is available
  if (!db) {
    console.error('❌ Database not available');
    return json({ 
      error: 'Database not available',
      data: [],
      source,
      metric,
      range
    }, { status: 500 });
  }

  try {
    // Test database connection
    const testQuery = db.prepare('SELECT 1 as test');
    const testResult = testQuery.get();
    console.log('✅ Database connection test passed:', testResult);

    // Calculate time range
    const now = Math.floor(Date.now() / 1000);
    let startTime;
    if (range === 'all') {
      startTime = 0;
    } else {
      const days = parseInt(range.replace('d', '').replace('y', '')) || 30;
      const multiplier = range.includes('y') ? 365 : 1;
      startTime = now - (days * multiplier * 24 * 60 * 60);
    }

    console.log(`📊 Time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`);

    let data = [];

    if (source === 'transactions') {
      data = await getTransactionData(metric, startTime, now);
    } else if (source === 'node_stats') {
      data = await getNodeStatsData(metric, startTime, now);
    } else if (source === 'network_utilization') {
      data = await getNetworkUtilizationData(metric, startTime, now);
    } else {
      console.warn(`⚠️ Unknown data source: ${source}`);
    }

    console.log(`📊 Final result: ${data.length} data points`);

    return json({ 
      data, 
      source, 
      metric, 
      range,
      count: data.length,
      startTime: new Date(startTime * 1000).toISOString(),
      endTime: new Date(now * 1000).toISOString()
    });

  } catch (error) {
    console.error('❌ Chart API Error:', error);
    return json({ 
      error: error.message,
      data: [],
      source,
      metric,
      range
    }, { status: 500 });
  }
}

// Transaction data handler
async function getTransactionData(metric, startTime, endTime) {
  try {
    // Check if transactions table exists and has data
    const countQuery = db.prepare('SELECT COUNT(*) as count FROM transactions');
    const countResult = countQuery.get();
    console.log(`💰 Transactions in database: ${countResult.count}`);

    if (countResult.count === 0) {
      console.log('💰 No transactions found in database');
      return [];
    }

    let data = [];

    if (metric === 'revenue' || metric === 'volume') {
      const revenueQuery = db.prepare(`
        SELECT 
          date(timestamp, 'unixepoch') as date,
          SUM(value) as daily_revenue
        FROM transactions 
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY date(timestamp, 'unixepoch')
        ORDER BY date ASC
      `);
      
      const results = revenueQuery.all(startTime, endTime);
      console.log(`💰 Revenue query returned ${results.length} rows`);
      
      data = results.map(row => ({
        date: row.date,
        value: parseFloat(row.daily_revenue || 0)
      }));
      
    } else if (metric === 'count') {
      const countQuery = db.prepare(`
        SELECT 
          date(timestamp, 'unixepoch') as date,
          COUNT(*) as transaction_count
        FROM transactions 
        WHERE timestamp >= ? AND timestamp <= ?
        GROUP BY date(timestamp, 'unixepoch')
        ORDER BY date ASC
      `);
      
      const results = countQuery.all(startTime, endTime);
      console.log(`💰 Count query returned ${results.length} rows`);
      
      data = results.map(row => ({
        date: row.date,
        value: parseInt(row.transaction_count || 0)
      }));
    }

    return data;
  } catch (error) {
    console.error('❌ Error querying transactions:', error);
    return [];
  }
}

// Node statistics data handler
async function getNodeStatsData(metric, startTime, endTime) {
  try {
    // Check if node stats table exists and has data
    const countQuery = db.prepare('SELECT COUNT(*) as count FROM network_node_stats');
    const countResult = countQuery.get();
    console.log(`🖥️ Node stats in database: ${countResult.count}`);

    if (countResult.count === 0) {
      console.log('🖥️ No node stats found in database');
      return [];
    }

    // Validate metric column exists
    const validMetrics = [
      'total_nodes', 'cumulus_nodes', 'nimbus_nodes', 'stratus_nodes', 'arcane_nodes',
      'cumulus_percentage', 'nimbus_percentage', 'stratus_percentage', 'arcane_percentage'
    ];

    if (!validMetrics.includes(metric)) {
      console.warn(`⚠️ Invalid node stats metric: ${metric}`);
      return [];
    }

    const nodeQuery = db.prepare(`
      SELECT 
        date(timestamp, 'unixepoch') as date,
        AVG(${metric}) as avg_value,
        MIN(${metric}) as min_value,
        MAX(${metric}) as max_value,
        COUNT(*) as data_points
      FROM network_node_stats 
      WHERE timestamp >= ? AND timestamp <= ?
        AND data_source != 'failed'
      GROUP BY date(timestamp, 'unixepoch')
      ORDER BY date ASC
    `);
    
    const results = nodeQuery.all(startTime, endTime);
    console.log(`🖥️ Node stats query returned ${results.length} rows`);
    
    const data = results.map(row => ({
      date: row.date,
      value: parseFloat(row.avg_value || 0),
      min: parseFloat(row.min_value || 0),
      max: parseFloat(row.max_value || 0),
      points: parseInt(row.data_points || 0)
    }));

    return data;
  } catch (error) {
    console.error('❌ Error querying node stats:', error);
    return [];
  }
}

// Network utilization data handler
async function getNetworkUtilizationData(metric, startTime, endTime) {
  try {
    // Check if utilization stats table exists and has data
    const countQuery = db.prepare('SELECT COUNT(*) as count FROM network_utilization_stats');
    const countResult = countQuery.get();
    console.log(`📊 Utilization stats in database: ${countResult.count}`);

    if (countResult.count === 0) {
      console.log('📊 No utilization stats found in database');
      return [];
    }

    // Validate metric column exists
    const validMetrics = [
      'total_cores', 'total_ram_gb', 'total_ssd_gb',
      'utilized_cores', 'utilized_nodes', 'utilized_ram_gb', 'utilized_ssd_gb',
      'cores_percentage', 'nodes_percentage', 'ram_percentage', 'ssd_percentage',
      'running_apps', 'nodes_with_apps', 'watchtower_instances'
    ];

    if (!validMetrics.includes(metric)) {
      console.warn(`⚠️ Invalid utilization metric: ${metric}`);
      return [];
    }

    const utilizationQuery = db.prepare(`
      SELECT 
        date(timestamp, 'unixepoch') as date,
        AVG(${metric}) as avg_value,
        MIN(${metric}) as min_value,
        MAX(${metric}) as max_value,
        COUNT(*) as data_points
      FROM network_utilization_stats 
      WHERE timestamp >= ? AND timestamp <= ?
        AND data_source != 'failed'
      GROUP BY date(timestamp, 'unixepoch')
      ORDER BY date ASC
    `);
    
    const results = utilizationQuery.all(startTime, endTime);
    console.log(`📊 Utilization query returned ${results.length} rows`);
    
    const data = results.map(row => ({
      date: row.date,
      value: parseFloat(row.avg_value || 0),
      min: parseFloat(row.min_value || 0),
      max: parseFloat(row.max_value || 0),
      points: parseInt(row.data_points || 0)
    }));

    return data;
  } catch (error) {
    console.error('❌ Error querying utilization stats:', error);
    return [];
  }
}