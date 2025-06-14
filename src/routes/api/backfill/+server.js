import { json } from '@sveltejs/kit';
import { backfillFromAddresses } from '../../../lib/scheduler.js';

export async function POST({ url }) {
  try {
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const maxLimit = 500; // Safety limit
    const actualLimit = Math.min(Math.max(1, limit), maxLimit);
    
    console.log(`🔍 Starting manual backfill of up to ${actualLimit} transactions...`);
    
    const result = await backfillFromAddresses(actualLimit);
    
    return json({
      success: true,
      ...result,
      limit: actualLimit
    });
    
  } catch (error) {
    console.error('❌ Backfill API error:', error);
    return json({ 
      success: false, 
      error: error.message,
      updated: 0
    }, { status: 500 });
  }
}

export async function GET() {
  return json({
    message: 'Use POST to start backfill process',
    usage: 'POST /api/backfill?limit=100',
    description: 'Backfills from_address for transactions that are missing this data'
  });
}