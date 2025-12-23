require('dotenv').config();

const config = require('./config');
const db = require('./db');

// Conditional imports based on mode
let BrowserPool, startServer, scheduler, webhookNotifier;

async function main() {
  const mode = config.mode;
  const runApi = mode === 'full' || mode === 'api';
  const runWorkers = mode === 'full' || mode === 'worker';

  console.log('===========================================');
  console.log('   PRICE CHECKER - Service');
  console.log('===========================================');
  console.log('');
  console.log('Configuration:');
  console.log(`  - Mode: ${mode}`);
  if (runWorkers) {
    console.log(`  - Workers: ${config.workers.count}`);
    console.log(`  - Sources: ${config.sources.mode}`);
  }
  if (runApi) {
    console.log(`  - API port: ${config.api.port}`);
    console.log(`  - API auth: ${config.api.secret ? 'Enabled' : 'Disabled'}`);
  }
  console.log(`  - Check interval: ${config.schedule.defaultIntervalSeconds / 3600}h`);
  console.log('');

  try {
    // Initialize PostgreSQL schema (creates tables if needed)
    console.log('Initializing database schema...');
    await db.initSchema();

    // Only check source count if we're doing local sync (API/full mode)
    if (mode !== 'worker' || !process.env.PRICE_SERVER_URL) {
      console.log('Testing PostgreSQL connection...');
      const sourceCount = await db.getSourceCount();
      console.log(`  Found ${sourceCount} active price sources in main database`);
    } else {
      console.log('Worker mode: sync will be triggered on Price Server');
    }

    // Start API server (if mode includes API)
    if (runApi) {
      const { startServer: start } = require('./api/server');
      startServer = start;

      console.log('');
      console.log('Starting API server...');
      await startServer();
    }

    // Initialize workers (if mode includes workers)
    if (runWorkers) {
      const { getPool } = require('./browser/BrowserPool');
      BrowserPool = getPool;
      scheduler = require('./scheduler/Scheduler');

      // Optional webhook support
      try {
        webhookNotifier = require('./webhook/notifier');
      } catch (e) {
        // Webhook module not available
      }

      console.log('');
      console.log('Initializing browser pool...');
      const pool = BrowserPool();
      await pool.init();

      // Start webhook retry loop if available
      if (webhookNotifier && config.webhook?.url) {
        webhookNotifier.startRetryLoop();
      }

      // Start the scheduler (syncs products and runs workers)
      console.log('');
      console.log('Starting scheduler...');
      await scheduler.start();
    }

    console.log('');
    console.log('===========================================');
    console.log(`   Price Checker running in ${mode.toUpperCase()} mode`);
    console.log('===========================================');
    console.log('');

    if (runApi) {
      console.log('API Endpoints:');
      console.log(`  GET  http://localhost:${config.api.port}/health`);
      console.log(`  GET  http://localhost:${config.api.port}/api/products`);
      console.log(`  GET  http://localhost:${config.api.port}/api/comparison`);
      console.log(`  GET  http://localhost:${config.api.port}/api/prices`);
      console.log(`  GET  http://localhost:${config.api.port}/api/changes`);
      console.log(`  POST http://localhost:${config.api.port}/refresh/:sourceId`);
      console.log(`  POST http://localhost:${config.api.port}/sync`);
      console.log('');
    }

    // Handle graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Failed to start:', error);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('');
  console.log('Shutting down...');

  try {
    if (scheduler) await scheduler.stop();
    if (BrowserPool) await BrowserPool().close();
    await db.close();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

main();
