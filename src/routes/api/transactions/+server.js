import { json } from '@sveltejs/kit';
import { statements } from '../../../lib/db.js';
import { getAllTargetAddresses } from '../../../lib/config.js';

export async function GET({ url }) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const search = url.searchParams.get('search') || '';
  const address = url.searchParams.get('address') || null;
  const breakdown = url.searchParams.get('breakdown') === 'true';
  
  // Ensure page is at least 1
  const currentPage = Math.max(1, page);
  const itemsPerPage = Math.min(Math.max(1, limit), 100); // Cap at 100 items per page
  const offset = (currentPage - 1) * itemsPerPage;
  
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
    
    if (breakdown && addressesToQuery.length > 1) {
      // Return breakdown by address
      const addressBreakdown = {};
      
      for (const addr of addressesToQuery) {
        let transactions = [];
        let total = 0;
        
        if (search.trim()) {
          const searchTerm = `%${search.trim()}%`;
          transactions = statements.searchTransactionsPaginated.all(
            addr,
            searchTerm,  // for tx_hash
            searchTerm,  // for from_address
            searchTerm,  // for value
            itemsPerPage,
            offset
          );
          
          const totalResult = statements.searchTransactionsCount.get(
            addr,
            searchTerm,
            searchTerm,
            searchTerm
          );
          total = totalResult?.total || 0;
        } else {
          transactions = statements.getTransactionsPaginated.all(
            addr,
            itemsPerPage,
            offset
          );
          
          const totalResult = statements.getTransactionsCount.get(addr);
          total = totalResult?.total || 0;
        }
        
        // Format transactions
        const formattedTransactions = transactions.map(tx => ({
          id: tx.id,
          from: tx.from_address || 'Unknown',
          to: addr,
          amount: tx.amount || 0,
          date: tx.date ? new Date(tx.date * 1000).toISOString() : null,
          blockHeight: tx.block_height
        }));
        
        addressBreakdown[addr] = {
          transactions: formattedTransactions,
          total: total,
          address: addr
        };
      }
      
      const totalPages = Math.max(...Object.values(addressBreakdown).map(b => Math.ceil(b.total / itemsPerPage)));
      
      return json({
        breakdown: addressBreakdown,
        pagination: {
          currentPage,
          totalPages,
          itemsPerPage,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        },
        search: search.trim(),
        addresses: addressesToQuery
      });
    } else {
      // Combined transactions from all addresses
      let allTransactions = [];
      let totalCount = 0;
      
      for (const addr of addressesToQuery) {
        let transactions = [];
        let count = 0;
        
        if (search.trim()) {
          const searchTerm = `%${search.trim()}%`;
          transactions = statements.searchTransactionsPaginated.all(
            addr,
            searchTerm,
            searchTerm,
            searchTerm,
            itemsPerPage * 2, // Get more to account for sorting
            0 // Start from beginning for sorting
          );
          
          const totalResult = statements.searchTransactionsCount.get(
            addr,
            searchTerm,
            searchTerm,
            searchTerm
          );
          count = totalResult?.total || 0;
        } else {
          transactions = statements.getTransactionsPaginated.all(
            addr,
            itemsPerPage * 2, // Get more to account for sorting
            0 // Start from beginning for sorting
          );
          
          const totalResult = statements.getTransactionsCount.get(addr);
          count = totalResult?.total || 0;
        }
        
        // Format and add address info
        const formattedTransactions = transactions.map(tx => ({
          id: tx.id,
          from: tx.from_address || 'Unknown',
          to: addr,
          amount: tx.amount || 0,
          date: tx.date ? new Date(tx.date * 1000).toISOString() : null,
          blockHeight: tx.block_height,
          timestamp: tx.date // Keep for sorting
        }));
        
        allTransactions.push(...formattedTransactions);
        totalCount += count;
      }
      
      // Sort all transactions by timestamp (newest first)
      allTransactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      // Apply pagination to sorted results
      const paginatedTransactions = allTransactions.slice(offset, offset + itemsPerPage);
      
      // Remove timestamp from final results
      paginatedTransactions.forEach(tx => delete tx.timestamp);
      
      const totalPages = Math.ceil(totalCount / itemsPerPage);
      
      return json({
        transactions: paginatedTransactions,
        pagination: {
          currentPage,
          totalPages,
          itemsPerPage,
          totalItems: totalCount,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1
        },
        search: search.trim(),
        addresses: addressesToQuery,
        addresses_count: addressesToQuery.length
      });
    }
    
  } catch (error) {
    console.error('Transactions API error:', error);
    
    // Fallback: if the database doesn't have the new transaction queries or from_address column
    if (error.message.includes('no such column') || error.message.includes('SQLITE_ERROR')) {
      return json({
        transactions: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          itemsPerPage,
          totalItems: 0,
          hasNext: false,
          hasPrev: false
        },
        search: search.trim(),
        error: 'Database schema needs to be updated for transaction pagination and from_address support.',
        addresses: getAllTargetAddresses()
      });
    }
    
          return json({ 
      error: error.message,
      transactions: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        itemsPerPage,
        totalItems: 0,
        hasNext: false,
        hasPrev: false
      },
      addresses: getAllTargetAddresses()
    }, { status: 500 });
  }
}