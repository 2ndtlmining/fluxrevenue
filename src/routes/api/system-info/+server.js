import { json } from '@sveltejs/kit';
import os from 'os';

export async function GET() {
  return json({
    os: `${os.type()} ${os.release()}`,
    cpu: `${os.cpus().length} cores`,
    totalRam: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
    nodeVersion: process.version,
    uptime: formatUptime(os.uptime()),
    loadAverage: `load average: ${os.loadavg().map(l => l.toFixed(2)).join(', ')}`,
    memory: `Mem: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
    dbSize: "485MB", // You'd calculate this from your actual DB
  });
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `up ${days} days, ${hours}:${mins.toString().padStart(2, '0')}`;
}