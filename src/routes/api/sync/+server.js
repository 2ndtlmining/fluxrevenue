import { json } from '@sveltejs/kit';
import { performSync } from '../../../lib/scheduler.js';

export async function POST() {
  try {
    const result = await performSync();
    return json(result);
  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
}