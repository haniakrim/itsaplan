import { resolveInstanceStorageConfig } from '@repo/db';
import { setStorageConfigSource } from '@repo/storage';
import { startWorker } from './worker';
import { startAgentWorker } from './agent-worker';
import { startImportWorker } from './import-worker';

// Entry point for webhook delivery, agent scheduling, autonomous agent runs,
// and source imports. The api applies database migrations on startup.
console.log('[worker] worker starting');
// File storage settings come from god mode, with the environment as fallback.
setStorageConfigSource(resolveInstanceStorageConfig);
const worker = startWorker();
const agentWorker = startAgentWorker();
const importWorker = startImportWorker();

function shutdown(signal: string): void {
  console.log(`[worker] ${signal} received, stopping`);
  worker.stop();
  agentWorker.stop();
  importWorker.stop();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
