/**
 * Database Layer
 *
 * Provides a unified interface for database operations using the adapter pattern.
 * Supports PostgreSQL and SQLite with automatic SSH tunnel creation.
 *
 * Usage:
 *   const db = require('./db');
 *   await db.init();
 *   // ... use db functions
 *   await db.close();
 */
const config = require('../config');
const adapters = require('./adapters');
const { createDatabaseTunnels } = require('./ssh-tunnel');

let tunnels = null;
let initialized = false;

/**
 * Filter sources by domain based on config mode
 */
function filterSourcesByMode(sources) {
  const mode = config.sources.mode;

  // First filter out sources with invalid URLs
  const validSources = sources.filter(source => {
    if (!source.url) return false;
    try {
      new URL(source.url);
      return true;
    } catch {
      return false;
    }
  });

  if (mode === 'all') {
    return validSources;
  }

  const allowedDomains = mode === 'local'
    ? config.sources.localDomains
    : config.sources.internationalDomains;

  return validSources.filter(source => {
    const domain = source.domain || new URL(source.url).hostname.replace('www.', '');
    return allowedDomains.some(d => domain.includes(d));
  });
}

/**
 * Build domain filter SQL clause based on config mode
 */
function buildDomainFilter() {
  const mode = config.sources.mode;

  if (mode === 'all') {
    return '';
  }

  const domains = mode === 'local'
    ? config.sources.localDomains
    : config.sources.internationalDomains;

  const conditions = domains.map(d => `url LIKE '%${d}%'`).join(' OR ');
  return `AND (${conditions})`;
}

/**
 * Initialize database connection(s) with optional SSH tunnels
 */
async function init() {
  if (initialized) return;

  // Create SSH tunnels if enabled
  if (config.ssh?.enabled) {
    console.log('[db] Setting up SSH tunnels...');
    try {
      tunnels = await createDatabaseTunnels(config);
    } catch (err) {
      console.error('[db] Failed to create SSH tunnels:', err.message);
      throw err;
    }
  }

  // Connect adapter
  await adapters.connect();
  await adapters.initSchema();

  // Ensure data directory exists for SQLite
  if (config.database?.type === 'sqlite') {
    const fs = require('fs');
    const path = require('path');
    const dbDir = path.dirname(config.sqlite.database);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  initialized = true;
}

// Alias for backward compatibility
async function initSchema() {
  await init();
}

/**
 * Close database connection(s) and SSH tunnels
 */
async function close() {
  await adapters.close();

  if (tunnels) {
    await tunnels.close();
    tunnels = null;
  }

  initialized = false;
  console.log('[db] All connections closed');
}

// ==================== MAIN BACKEND QUERIES ====================

async function fetchPriceSources() {
  const result = await adapters.mainQuery(`
    SELECT
      cps.id as source_id,
      cps.product_id,
      cps.url,
      cps.domain,
      cps.store_name,
      cps.handler_key,
      cps.is_international,
      cps.priority,
      cps.metadata,
      cps.last_fetched_at,
      cps.last_successful_at,
      cps.consecutive_failures,
      p.name_en as product_name,
      p.sku,
      p.price as current_price
    FROM competitor_price_sources cps
    JOIN products p ON p.id = cps.product_id
    WHERE cps.is_active = true
      AND cps.deleted_at IS NULL
      AND p.deleted_at IS NULL
    ORDER BY cps.priority DESC, cps.last_fetched_at ASC NULLS FIRST
  `);
  return filterSourcesByMode(result.rows);
}

async function getPriceSource(sourceId) {
  const result = await adapters.mainQuery(`
    SELECT
      cps.id as source_id,
      cps.product_id,
      cps.url,
      cps.domain,
      cps.store_name,
      cps.handler_key,
      cps.is_international,
      cps.priority,
      cps.metadata,
      p.name_en as product_name,
      p.sku,
      p.price as current_price
    FROM competitor_price_sources cps
    JOIN products p ON p.id = cps.product_id
    WHERE cps.id = $1
      AND cps.is_active = true
      AND cps.deleted_at IS NULL
  `, [sourceId]);
  return result.rows[0] || null;
}

async function getPriceSourcesByProduct(productId) {
  const result = await adapters.mainQuery(`
    SELECT
      cps.id as source_id,
      cps.product_id,
      cps.url,
      cps.domain,
      cps.store_name,
      cps.handler_key,
      cps.is_international,
      cps.priority,
      cps.metadata
    FROM competitor_price_sources cps
    WHERE cps.product_id = $1
      AND cps.is_active = true
      AND cps.deleted_at IS NULL
    ORDER BY cps.priority DESC
  `, [productId]);
  return result.rows;
}

async function getSourceCount() {
  const result = await adapters.mainQuery(`
    SELECT COUNT(*) as count
    FROM competitor_price_sources cps
    JOIN products p ON p.id = cps.product_id
    WHERE cps.is_active = true
      AND cps.deleted_at IS NULL
      AND p.deleted_at IS NULL
  `);
  return parseInt(result.rows[0].count);
}

async function getProductsByIds(ids) {
  if (!ids || ids.length === 0) return [];

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const result = await adapters.mainQuery(`
    SELECT id, sku, name_en, price
    FROM products
    WHERE id IN (${placeholders})
      AND deleted_at IS NULL
  `, ids);
  return result.rows;
}

async function getProduct(productId) {
  const result = await adapters.mainQuery(`
    SELECT id, sku, name_en, price
    FROM products
    WHERE id = $1 AND deleted_at IS NULL
  `, [productId]);
  return result.rows[0] || null;
}

async function getProductsWithSources() {
  const result = await adapters.mainQuery(`
    SELECT DISTINCT p.id, p.sku, p.name_en, p.price
    FROM products p
    JOIN competitor_price_sources cps ON cps.product_id = p.id
    WHERE cps.is_active = true
      AND cps.deleted_at IS NULL
      AND p.deleted_at IS NULL
    ORDER BY p.name_en
  `);
  return result.rows;
}

// ==================== PRICES ====================

async function getPrice(sourceId) {
  const result = await adapters.query(
    'SELECT * FROM prices WHERE source_id = $1',
    [sourceId]
  );
  return result.rows[0] || null;
}

async function getPriceByProduct(productId) {
  const result = await adapters.query(
    'SELECT * FROM prices WHERE product_id = $1 ORDER BY checked_at DESC',
    [productId]
  );
  return result.rows;
}

async function getAllPrices() {
  const result = await adapters.query('SELECT * FROM prices');
  return result.rows;
}

async function upsertPrice(sourceId, productId, url, handlerKey, price, currency, rawPrice, inStock = true) {
  const now = new Date().toISOString();
  await adapters.query(`
    INSERT INTO prices (source_id, product_id, url, handler_key, price, currency, raw_price, in_stock, checked_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT(source_id) DO UPDATE SET
      price = EXCLUDED.price,
      currency = EXCLUDED.currency,
      raw_price = EXCLUDED.raw_price,
      in_stock = EXCLUDED.in_stock,
      checked_at = EXCLUDED.checked_at
  `, [sourceId, productId, url, handlerKey, price, currency, rawPrice, inStock, now]);
}

// ==================== PRICE HISTORY ====================

async function addPriceHistory(sourceId, productId, price, currency) {
  const now = new Date().toISOString();
  await adapters.query(
    'INSERT INTO price_history (source_id, product_id, price, currency, checked_at) VALUES ($1, $2, $3, $4, $5)',
    [sourceId, productId, price, currency, now]
  );
}

async function getPriceHistory(sourceId, limit = 100) {
  const result = await adapters.query(
    'SELECT * FROM price_history WHERE source_id = $1 ORDER BY checked_at DESC LIMIT $2',
    [sourceId, limit]
  );
  return result.rows;
}

async function getProductPriceHistory(productId, since) {
  const result = await adapters.query(
    'SELECT * FROM price_history WHERE product_id = $1 AND checked_at >= $2 ORDER BY checked_at ASC',
    [productId, since]
  );
  return result.rows;
}

// ==================== PRICE CHANGES ====================

async function logPriceChange(sourceId, productId, url, oldPrice, newPrice, currency) {
  await adapters.query(
    'INSERT INTO price_changes (source_id, product_id, url, old_price, new_price, currency) VALUES ($1, $2, $3, $4, $5, $6)',
    [sourceId, productId, url, oldPrice, newPrice, currency]
  );
}

async function getRecentChanges(sinceTimestamp) {
  const result = await adapters.query(
    'SELECT * FROM price_changes WHERE changed_at > $1 ORDER BY changed_at DESC',
    [sinceTimestamp]
  );
  return result.rows;
}

async function markChangeWebhookSent(changeId) {
  const now = new Date().toISOString();
  await adapters.query(
    'UPDATE price_changes SET webhook_sent = true, webhook_sent_at = $1 WHERE id = $2',
    [now, changeId]
  );
}

// ==================== FAILED WEBHOOKS ====================

async function addFailedWebhook(payload) {
  await adapters.query(
    'INSERT INTO failed_webhooks (payload) VALUES ($1)',
    [JSON.stringify(payload)]
  );
}

async function getFailedWebhooks(maxAttempts = 5) {
  const result = await adapters.query(
    'SELECT * FROM failed_webhooks WHERE attempts < $1 ORDER BY created_at ASC',
    [maxAttempts]
  );
  return result.rows;
}

async function incrementWebhookAttempt(webhookId) {
  const now = new Date().toISOString();
  await adapters.query(
    'UPDATE failed_webhooks SET attempts = attempts + 1, last_attempt_at = $1 WHERE id = $2',
    [now, webhookId]
  );
}

async function deleteFailedWebhook(webhookId) {
  await adapters.query('DELETE FROM failed_webhooks WHERE id = $1', [webhookId]);
}

// ==================== JOB QUEUE ====================

async function addToQueue(sourceId, productId, url, handlerKey, priority = 0, nextCheckAt = null) {
  const now = new Date().toISOString();
  nextCheckAt = nextCheckAt || now;

  await adapters.query(`
    INSERT INTO job_queue (source_id, product_id, url, handler_key, priority, status, next_check_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7)
    ON CONFLICT(source_id) DO UPDATE SET
      priority = GREATEST(EXCLUDED.priority, job_queue.priority),
      status = CASE WHEN job_queue.status = 'processing' THEN job_queue.status ELSE 'pending' END,
      next_check_at = LEAST(EXCLUDED.next_check_at, job_queue.next_check_at),
      updated_at = EXCLUDED.updated_at
  `, [sourceId, productId, url, handlerKey, priority, nextCheckAt, now]);
}

async function getNextJob() {
  const domainFilter = buildDomainFilter();
  return adapters.getNextJobWithLock(domainFilter);
}

async function completeJob(jobId, nextCheckAt) {
  const now = new Date().toISOString();
  await adapters.query(
    'UPDATE job_queue SET status = $1, priority = 0, next_check_at = $2, updated_at = $3 WHERE id = $4',
    ['pending', nextCheckAt, now, jobId]
  );
}

async function failJob(jobId, nextCheckAt) {
  const now = new Date().toISOString();
  await adapters.query(
    'UPDATE job_queue SET status = $1, next_check_at = $2, updated_at = $3 WHERE id = $4',
    ['pending', nextCheckAt, now, jobId]
  );
}

async function prioritizeSource(sourceId) {
  const now = new Date().toISOString();
  await adapters.query(
    'UPDATE job_queue SET priority = 100, next_check_at = $1, updated_at = $1 WHERE source_id = $2',
    [now, sourceId]
  );
}

async function getQueueStats() {
  const now = new Date().toISOString();
  const result = await adapters.query(`
    SELECT
      CASE
        WHEN status = 'processing' THEN 'processing'
        WHEN status = 'pending' AND next_check_at <= $1 THEN 'ready'
        ELSE 'scheduled'
      END as status,
      COUNT(*) as count,
      AVG(priority) as avg_priority
    FROM job_queue
    GROUP BY 1
  `, [now]);
  return result.rows.map(row => ({
    ...row,
    count: parseInt(row.count),
    avg_priority: parseFloat(row.avg_priority || 0),
  }));
}

async function clearQueue() {
  await adapters.query('DELETE FROM job_queue');
}

async function getJobBySourceId(sourceId) {
  const result = await adapters.query(
    'SELECT * FROM job_queue WHERE source_id = $1',
    [sourceId]
  );
  return result.rows[0] || null;
}

async function getJobsWithPrices(limit = 50, offset = 0) {
  const result = await adapters.query(`
    SELECT
      jq.*,
      p.price as current_price,
      p.currency,
      p.checked_at as last_checked
    FROM job_queue jq
    LEFT JOIN prices p ON p.source_id = jq.source_id
    ORDER BY
      CASE jq.status WHEN 'processing' THEN 0 ELSE 1 END,
      jq.priority DESC,
      jq.next_check_at ASC
    LIMIT $1 OFFSET $2
  `, [limit, offset]);
  return result.rows;
}

async function getJobCount() {
  const result = await adapters.query('SELECT COUNT(*) as count FROM job_queue');
  return parseInt(result.rows[0]?.count || 0);
}

// ==================== UTILS ====================

async function isFresh(sourceId, thresholdSeconds) {
  const price = await getPrice(sourceId);
  if (!price) return false;

  const checkedAt = new Date(price.checked_at);
  const now = new Date();
  const ageSeconds = (now - checkedAt) / 1000;

  return ageSeconds < thresholdSeconds;
}

module.exports = {
  // Init
  init,
  initSchema,
  // Main backend queries
  fetchPriceSources,
  getPriceSource,
  getPriceSourcesByProduct,
  getSourceCount,
  getProductsByIds,
  getProduct,
  getProductsWithSources,
  // Prices
  getPrice,
  getPriceByProduct,
  getAllPrices,
  upsertPrice,
  // History
  addPriceHistory,
  getPriceHistory,
  getProductPriceHistory,
  // Changes
  logPriceChange,
  getRecentChanges,
  markChangeWebhookSent,
  // Failed webhooks
  addFailedWebhook,
  getFailedWebhooks,
  incrementWebhookAttempt,
  deleteFailedWebhook,
  // Queue
  addToQueue,
  getNextJob,
  completeJob,
  failJob,
  prioritizeSource,
  getQueueStats,
  clearQueue,
  getJobBySourceId,
  getJobsWithPrices,
  getJobCount,
  // Utils
  isFresh,
  close,
};
