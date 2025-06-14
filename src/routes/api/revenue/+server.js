import { json } from '@sveltejs/kit';
import { statements } from '../../../lib/db.js';
import { getAllTargetAddresses } from '../../../lib/config.js';

export async function GET({ url }) {
  const days = parseInt(url.searchParams.get('days') || '30');
  const address = url.searchParams.get('address') || null;
  const breakdown = url.searchParams.get('breakdown') === 'true';
  
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
    
    const cutoffTime = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);
    
    if (breakdown && addressesToQuery.length > 1) {
      // Return breakdown by address
      const addressBreakdown = {};
      let totalRevenue = 0;
      let totalCount = 0;
      
      for (const addr of addressesToQuery) {
        // Get daily data for this address
        const dailyData = statements.getRevenueData.all(addr, cutoffTime);
        
        // Get total for this address
        const totalData = statements.getTotalRevenue.get(addr);
        
        addressBreakdown[addr] = {
          daily: dailyData,
          total: {
            total: totalData?.total || 0,
            count: totalData?.count || 0,
            first_payment: totalData?.first_payment,
            last_payment: totalData?.last_payment
          }
        };
        
        totalRevenue += totalData?.total || 0;
        totalCount += totalData?.count || 0;
      }
      
      return json({
        breakdown: addressBreakdown,
        summary: {
          total_revenue: totalRevenue,
          total_count: totalCount,
          addresses_count: addressesToQuery.length,
          addresses: addressesToQuery
        },
        days,
        cutoff_time: cutoffTime
      });
    } else {
      // Combined data for all requested addresses
      let combinedDaily = [];
      let combinedTotal = { total: 0, count: 0, first_payment: null, last_payment: null };
      
      if (addressesToQuery.length === 1) {
        // Single address - direct query
        combinedDaily = statements.getRevenueData.all(addressesToQuery[0], cutoffTime);
        const totalData = statements.getTotalRevenue.get(addressesToQuery[0]);
        combinedTotal = {
          total: totalData?.total || 0,
          count: totalData?.count || 0,
          first_payment: totalData?.first_payment,
          last_payment: totalData?.last_payment
        };
      } else {
        // Multiple addresses - combine results
        const dailyByDate = {};
        
        for (const addr of addressesToQuery) {
          const dailyData = statements.getRevenueData.all(addr, cutoffTime);
          const totalData = statements.getTotalRevenue.get(addr);
          
          // Add to combined totals
          combinedTotal.total += totalData?.total || 0;
          combinedTotal.count += totalData?.count || 0;
          
          // Track earliest and latest payments
          if (totalData?.first_payment) {
            combinedTotal.first_payment = combinedTotal.first_payment 
              ? Math.min(combinedTotal.first_payment, totalData.first_payment)
              : totalData.first_payment;
          }
          if (totalData?.last_payment) {
            combinedTotal.last_payment = combinedTotal.last_payment 
              ? Math.max(combinedTotal.last_payment, totalData.last_payment)
              : totalData.last_payment;
          }
          
          // Combine daily data
          for (const day of dailyData) {
            if (!dailyByDate[day.date]) {
              dailyByDate[day.date] = { date: day.date, daily_revenue: 0, transaction_count: 0 };
            }
            dailyByDate[day.date].daily_revenue += day.daily_revenue || 0;
            dailyByDate[day.date].transaction_count += day.transaction_count || 0;
          }
        }
        
        // Convert combined daily data to array and sort
        combinedDaily = Object.values(dailyByDate).sort((a, b) => a.date.localeCompare(b.date));
      }
      
      return json({
        daily: combinedDaily,
        total: combinedTotal,
        addresses: addressesToQuery,
        addresses_count: addressesToQuery.length,
        days,
        cutoff_time: cutoffTime
      });
    }
  } catch (error) {
    console.error('Revenue API error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}