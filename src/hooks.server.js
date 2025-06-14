import { startScheduler } from './lib/scheduler.js';

let schedulerStarted = false;

export async function handle({ event, resolve }) {
  // Start scheduler only once when server starts
  if (!schedulerStarted) {
    schedulerStarted = true;
    console.log('🔧 Server starting - initializing scheduler...');
    
    // Start scheduler in background without blocking requests
    setTimeout(() => {
      startScheduler().catch(error => {
        console.error('❌ Failed to start scheduler:', error);
      });
    }, 2000);
  }

  return await resolve(event);
}