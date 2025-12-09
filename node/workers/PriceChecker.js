const { getPool } = require('../browser/BrowserPool');
const { fetchPage } = require('../browser/PageFetcher');
const { getHandler } = require('../handlers');
const db = require('../db/postgres');
const { notifyPriceChange } = require('../webhook/notifier');
const config = require('../config');

// Event emitter for on-demand requests waiting for results
const EventEmitter = require('events');
const priceEvents = new EventEmitter();

/**
 * Check price for a single source
 */
async function checkPrice(job) {
  const pool = getPool();
  const browserInstance = await pool.acquire();
  const startTime = Date.now();

  try {
    const domain = new URL(job.url).hostname.replace('www.', '');
    console.log(`[Worker ${browserInstance.id}] Checking: ${domain}`);

    // Fetch the page
    const html = await fetchPage(browserInstance, job.url);

    // Get the appropriate handler
    const handler = getHandler(job.url, job.handler_key);

    // Extract price
    const result = await handler.extractPrice(html, job.url);

    if (!result || !result.price) {
      console.log(`[Worker ${browserInstance.id}] No price found for ${job.url}`);
      return { success: false, error: 'No price found' };
    }

    const newPrice = parseFloat(result.price);
    const currency = result.currency || 'USD';

    // Get old price
    const oldPriceRecord = await db.getPrice(job.source_id);
    const oldPrice = oldPriceRecord ? parseFloat(oldPriceRecord.price) : null;

    // Update current price
    await db.upsertPrice(
      job.source_id,
      job.product_id,
      job.url,
      job.handler_key,
      newPrice,
      currency,
      result.raw,
      true
    );

    // Add to history
    await db.addPriceHistory(job.source_id, job.product_id, newPrice, currency);

    // Detect price change
    if (oldPrice !== null && oldPrice !== newPrice) {
      console.log(`[Worker ${browserInstance.id}] PRICE CHANGED: ${oldPrice} -> ${newPrice} (${job.url})`);

      // Log the change
      await db.logPriceChange(
        job.source_id,
        job.product_id,
        job.url,
        oldPrice,
        newPrice,
        currency
      );

      // Notify main server
      await notifyPriceChange({
        source_id: job.source_id,
        product_id: job.product_id,
        url: job.url,
        old_price: oldPrice,
        new_price: newPrice,
        currency,
      });
    }

    // Emit event for waiting on-demand requests
    priceEvents.emit(`price:${job.source_id}`, {
      success: true,
      source_id: job.source_id,
      product_id: job.product_id,
      price: newPrice,
      currency,
      raw: result.raw,
      checked_at: new Date().toISOString(),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Worker ${browserInstance.id}] ✓ ${domain}: ${newPrice} ${currency} (${elapsed}s)`);

    return {
      success: true,
      price: newPrice,
      currency,
      raw: result.raw,
      elapsed,
    };
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[Worker ${browserInstance.id}] ✗ Error (${elapsed}s):`, error.message);

    priceEvents.emit(`price:${job.source_id}`, {
      success: false,
      error: error.message,
    });

    return {
      success: false,
      error: error.message,
    };
  } finally {
    pool.release(browserInstance);
  }
}

/**
 * Process the next job in the queue
 */
async function processNextJob() {
  const job = await db.getNextJob();

  if (!job) {
    return null;
  }

  try {
    const result = await checkPrice(job);

    // Calculate next check time
    const nextCheckAt = new Date(
      Date.now() + config.schedule.defaultIntervalSeconds * 1000
    ).toISOString();

    if (result.success) {
      await db.completeJob(job.id, nextCheckAt);
    } else {
      // On failure, retry sooner (5 minutes)
      const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await db.failJob(job.id, retryAt);
    }

    return result;
  } catch (error) {
    // On error, retry in 5 minutes
    const retryAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await db.failJob(job.id, retryAt);
    throw error;
  }
}

/**
 * Request immediate price check for a source (for on-demand API)
 * Returns a promise that resolves when the price is checked
 */
async function requestPriceCheck(sourceId) {
  // Check if already fresh
  if (await db.isFresh(sourceId, config.schedule.freshnessThresholdSeconds)) {
    const price = await db.getPrice(sourceId);
    return {
      success: true,
      cached: true,
      ...price,
    };
  }

  // Prioritize this source in the queue
  await db.prioritizeSource(sourceId);

  // Wait for result
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      priceEvents.removeListener(`price:${sourceId}`, handler);
      resolve({ success: false, error: 'Timeout waiting for price check' });
    }, 120000); // 2 minute timeout

    const handler = (result) => {
      clearTimeout(timeout);
      resolve(result);
    };

    priceEvents.once(`price:${sourceId}`, handler);
  });
}

module.exports = {
  checkPrice,
  processNextJob,
  requestPriceCheck,
  priceEvents,
};
