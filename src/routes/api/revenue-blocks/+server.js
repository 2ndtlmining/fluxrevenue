import { json } from '@sveltejs/kit';
import { statements } from '../../../lib/db.js';
import { getAllTargetAddresses } from '../../../lib/config.js';

export async function GET({ url }) {
  const blocks = parseInt(url.searchParams.get('blocks') || '720');
  const address = url.searchParams.get('address') || null;
  
  try {
    // Determine which addresses to query
    const targetAddresses = getAllTargetAddresses();
    const addressesToQuery = address ? [address] : targetAddresses;
    
    // Validate requested address
    if (address && !targetAddresses.includes(address)) {
      return json({ 
        error: 'Address not in tracked list',
        trackedAddresses: targetAddresses 
      }, { status: 400 });
    }
    
    // Get current highest block height from our database
    const currentBlockResult = statements.getHighestBlock.get();
    const currentBlockHeight = currentBlockResult?.height || 0;
    
    if (currentBlockHeight === 0) {
      return json({
        error: 'No blocks synced yet',
        total_revenue: 0,
        total_count: 0,
        blocks_analyzed: 0,
        current_block_height: 0,
        addresses: addressesToQuery
      });
    }
    
    // Calculate the block range we want to analyze
    const startBlock = Math.max(0, currentBlockHeight - blocks);
    const endBlock = currentBlockHeight;
    
    let totalRevenue = 0;
    let totalCount = 0;
    let transactions = [];
    let addressBreakdown = {};
    
    // Process each address
    for (const addr of addressesToQuery) {
      try {
        // Get transactions for this address within the block range
        const addressTransactions = statements.getTransactionsByBlockRange.all(
          addr, 
          startBlock, 
          endBlock
        );
        
        // Calculate revenue for this address
        const addressRevenue = addressTransactions.reduce((sum, tx) => sum + (tx.value || 0), 0);
        const addressCount = addressTransactions.length;
        
        totalRevenue += addressRevenue;
        totalCount += addressCount;
        transactions.push(...addressTransactions);
        
        // Store breakdown data
        addressBreakdown[addr] = {
          revenue: addressRevenue,
          count: addressCount,
          transactions: addressTransactions.length
        };
        
      } catch (error) {
        console.error(`Error processing address ${addr}:`, error);
        // Continue with other addresses even if one fails
        addressBreakdown[addr] = {
          revenue: 0,
          count: 0,
          transactions: 0,
          error: error.message
        };
      }
    }
    
    // Sort transactions by block height (most recent first)
    transactions.sort((a, b) => b.block_height - a.block_height);
    
    // Calculate actual blocks analyzed (in case we hit the start of our data)
    const actualBlocksAnalyzed = endBlock - startBlock;
    
    // Create human-readable period description
    let periodDescription = '';
    if (blocks === 720) periodDescription = 'Last Day';
    else if (blocks === 5040) periodDescription = 'Last Week';  
    else if (blocks === 21600) periodDescription = 'Last Month';
    else if (blocks === 262800) periodDescription = 'Last Year';
    else periodDescription = `Last ${blocks} blocks`;
    
    const response = {
      total_revenue: totalRevenue,
      total_count: totalCount,
      blocks_requested: blocks,
      blocks_analyzed: actualBlocksAnalyzed,
      current_block_height: currentBlockHeight,
      start_block: startBlock,
      end_block: endBlock,
      period_description: periodDescription,
      addresses_count: addressesToQuery.length,
      addresses: addressesToQuery,
      breakdown: addressBreakdown,
      // Include sample transactions for debugging (limited to 5)
      sample_transactions: transactions.slice(0, 5).map(tx => ({
        id: tx.id,
        address: tx.address,
        value: tx.value,
        block_height: tx.block_height,
        timestamp: tx.timestamp,
        tx_hash: tx.tx_hash
      })),
      query_info: {
        method: 'block-height-based',
        requested_address: address,
        queried_addresses: addressesToQuery,
        calculation: `SUM(value) WHERE block_height BETWEEN ${startBlock} AND ${endBlock}`
      }
    };
    
    // Log for debugging
    console.log(`📊 Revenue blocks API: blocks ${startBlock}-${endBlock} = ${totalRevenue.toFixed(8)} FLUX from ${totalCount} transactions`);
    
    return json(response);
    
  } catch (error) {
    console.error('Revenue blocks API error:', error);
    return json({ 
      error: error.message,
      total_revenue: 0,
      total_count: 0,
      blocks_analyzed: 0,
      addresses: [],
      query_info: {
        error_details: error.stack
      }
    }, { status: 500 });
  }
}