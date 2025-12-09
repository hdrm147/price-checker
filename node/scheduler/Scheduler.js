const db = require('../db/postgres');
const { processNextJob } = require('../workers/PriceChecker');
const config = require('../config');

let isRunning = false;
let workerLoops = [];

/**
 * Sync products from main PostgreSQL database to local queue
 */
async function syncProducts() {
  console.log('Syncing products from main database...');

  try {
    const sources = await db.fetchPriceSources();
    console.log(`Found ${sources.length} active price sources`);

    let added = 0;
    let processed = 0;
    for (const source of sources) {
      processed++;
      if (processed % 100 === 0) {
        console.log(`  Processing source ${processed}/${sources.length}...`);
      }

      // Calculate next check time based on when it was last checked
      let nextCheckAt;

      const existingJob = await db.getJobBySourceId(source.source_id);
      const existingPrice = await db.getPrice(source.source_id);

      if (existingPrice) {
        // Already have data, schedule based on last check
        const lastChecked = new Date(existingPrice.checked_at);
        nextCheckAt = new Date(lastChecked.getTime() + config.schedule.defaultIntervalSeconds * 1000);

        // If already past due, schedule now
        if (nextCheckAt < new Date()) {
          nextCheckAt = new Date();
        }
      } else {
        // Never checked, schedule now
        nextCheckAt = new Date();
      }

      // Only add if not already in queue with higher priority
      if (!existingJob || existingJob.priority < source.priority) {
        await db.addToQueue(
          source.source_id,
          source.product_id,
          source.url,
          source.handler_key,
          source.priority,
          nextCheckAt.toISOString()
        );
        added++;
      }
    }

    console.log(`Sync complete: ${added} sources added/updated in queue`);
    return { total: sources.length, added };
  } catch (error) {
    console.error('Product sync failed:', error.message);
    throw error;
  }
}

/**
 * Worker loop - continuously processes jobs
 */
async function workerLoop(workerId) {
  console.log(`Worker loop ${workerId} started`);

  while (isRunning) {
    try {
      const result = await processNextJob();

      if (result === null) {
        // No jobs available, wait a bit
        await new Promise(r => setTimeout(r, 1000));
      } else {
        // Small delay between requests
        await new Promise(r => setTimeout(r, config.delays.betweenRequestsMs));
      }
    } catch (error) {
      console.error(`Worker ${workerId} error:`, error.message);
      await new Promise(r => setTimeout(r, 5000)); // Wait 5s on error
    }
  }

  console.log(`Worker loop ${workerId} stopped`);
}

/**
 * Start the scheduler
 */
async function start() {
  if (isRunning) {
    console.log('Scheduler already running');
    return;
  }

  isRunning = true;
  console.log('Starting scheduler...');

  // Initial product sync
  await syncProducts();

  // Start worker loops (one per browser)
  const workerCount = config.workers.count;
  for (let i = 0; i < workerCount; i++) {
    workerLoops.push(workerLoop(i));
  }

  // Periodic product sync
  setInterval(async () => {
    try {
      await syncProducts();
    } catch (error) {
      console.error('Periodic sync failed:', error.message);
    }
  }, config.schedule.productSyncIntervalMs);

  console.log(`Scheduler started with ${workerCount} workers`);
}

/**
 * Stop the scheduler
 */
async function stop() {
  console.log('Stopping scheduler...');
  isRunning = false;

  // Wait for worker loops to finish current job
  await Promise.all(workerLoops);
  workerLoops = [];

  console.log('Scheduler stopped');
}

/**
 * Get scheduler status
 */
async function getStatus() {
  return {
    running: isRunning,
    workers: workerLoops.length,
    queue: await db.getQueueStats(),
  };
}

module.exports = {
  syncProducts,
  start,
  stop,
  getStatus,
};
