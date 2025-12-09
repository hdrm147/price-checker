const { Pool } = require('pg');
const config = require('../config');

let pool = null;
let initialized = false;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user || undefined,
      password: config.postgres.password || undefined,
    });
  }
  return pool;
}

/**
 * Initialize the price checker tables in PostgreSQL
 */
async function initSchema() {
  if (initialized) return;

  const client = await getPool().connect();
  try {
    await client.query(`
      -- Current prices (latest price per source)
      CREATE TABLE IF NOT EXISTS prices (
        source_id BIGINT PRIMARY KEY,
        product_id BIGINT NOT NULL,
        url TEXT NOT NULL,
        handler_key TEXT,
        price DECIMAL(12, 2),
        currency VARCHAR(10) DEFAULT 'IQD',
        raw_price TEXT,
        in_stock BOOLEAN DEFAULT true,
        checked_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Price history for trends
      CREATE TABLE IF NOT EXISTS price_history (
        id BIGSERIAL PRIMARY KEY,
        source_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        price DECIMAL(12, 2),
        currency VARCHAR(10) DEFAULT 'IQD',
        checked_at TIMESTAMPTZ NOT NULL
      );

      -- Price changes log
      CREATE TABLE IF NOT EXISTS price_changes (
        id BIGSERIAL PRIMARY KEY,
        source_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        url TEXT,
        old_price DECIMAL(12, 2),
        new_price DECIMAL(12, 2),
        currency VARCHAR(10) DEFAULT 'IQD',
        changed_at TIMESTAMPTZ DEFAULT NOW(),
        webhook_sent BOOLEAN DEFAULT false,
        webhook_sent_at TIMESTAMPTZ
      );

      -- Failed webhooks for retry
      CREATE TABLE IF NOT EXISTS failed_webhooks (
        id BIGSERIAL PRIMARY KEY,
        payload JSONB NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Job queue for scheduling
      CREATE TABLE IF NOT EXISTS job_queue (
        id BIGSERIAL PRIMARY KEY,
        source_id BIGINT NOT NULL UNIQUE,
        product_id BIGINT NOT NULL,
        url TEXT NOT NULL,
        handler_key TEXT,
        priority INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        next_check_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_prices_product ON prices(product_id);
      CREATE INDEX IF NOT EXISTS idx_prices_checked ON prices(checked_at);
      CREATE INDEX IF NOT EXISTS idx_history_source ON price_history(source_id);
      CREATE INDEX IF NOT EXISTS idx_history_checked ON price_history(checked_at);
      CREATE INDEX IF NOT EXISTS idx_changes_product ON price_changes(product_id);
      CREATE INDEX IF NOT EXISTS idx_changes_time ON price_changes(changed_at);
      CREATE INDEX IF NOT EXISTS idx_queue_status ON job_queue(status, priority DESC, next_check_at);
      CREATE INDEX IF NOT EXISTS idx_queue_source ON job_queue(source_id);
    `);
    initialized = true;
    console.log('[postgres] Schema initialized');
  } finally {
    client.release();
  }
}

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
 * Fetch all active competitor price sources with product info
 */
async function fetchPriceSources() {
  const query = `
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
  `;

  const result = await getPool().query(query);
  return filterSourcesByMode(result.rows);
}

/**
 * Get a single price source by ID
 */
async function getPriceSource(sourceId) {
  const query = `
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
  `;

  const result = await getPool().query(query, [sourceId]);
  return result.rows[0] || null;
}

/**
 * Get price sources for a specific product
 */
async function getPriceSourcesByProduct(productId) {
  const query = `
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
  `;

  const result = await getPool().query(query, [productId]);
  return result.rows;
}

/**
 * Get count of active sources
 */
async function getSourceCount() {
  const query = `
    SELECT COUNT(*) as count
    FROM competitor_price_sources cps
    JOIN products p ON p.id = cps.product_id
    WHERE cps.is_active = true
      AND cps.deleted_at IS NULL
      AND p.deleted_at IS NULL
  `;

  const result = await getPool().query(query);
  return parseInt(result.rows[0].count);
}

/**
 * Get products by IDs
 */
async function getProductsByIds(ids) {
  if (!ids || ids.length === 0) return [];

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  const query = `
    SELECT id, sku, name_en, price
    FROM products
    WHERE id IN (${placeholders})
      AND deleted_at IS NULL
  `;

  const result = await getPool().query(query, ids);
  return result.rows;
}

/**
 * Get a single product by ID
 */
async function getProduct(productId) {
  const query = `
    SELECT id, sku, name_en, price
    FROM products
    WHERE id = $1 AND deleted_at IS NULL
  `;

  const result = await getPool().query(query, [productId]);
  return result.rows[0] || null;
}

/**
 * Get all products that have price sources
 */
async function getProductsWithSources() {
  const query = `
    SELECT DISTINCT p.id, p.sku, p.name_en, p.price
    FROM products p
    JOIN competitor_price_sources cps ON cps.product_id = p.id
    WHERE cps.is_active = true
      AND cps.deleted_at IS NULL
      AND p.deleted_at IS NULL
    ORDER BY p.name_en
  `;

  const result = await getPool().query(query);
  return result.rows;
}

// ==================== PRICES ====================

async function getPrice(sourceId) {
  const result = await getPool().query(
    'SELECT * FROM prices WHERE source_id = $1',
    [sourceId]
  );
  return result.rows[0] || null;
}

async function getPriceByProduct(productId) {
  const result = await getPool().query(
    'SELECT * FROM prices WHERE product_id = $1 ORDER BY checked_at DESC',
    [productId]
  );
  return result.rows;
}

async function getAllPrices() {
  const result = await getPool().query('SELECT * FROM prices');
  return result.rows;
}

async function upsertPrice(sourceId, productId, url, handlerKey, price, currency, rawPrice, inStock = true) {
  const now = new Date().toISOString();
  await getPool().query(`
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
  await getPool().query(
    'INSERT INTO price_history (source_id, product_id, price, currency, checked_at) VALUES ($1, $2, $3, $4, $5)',
    [sourceId, productId, price, currency, now]
  );
}

async function getPriceHistory(sourceId, limit = 100) {
  const result = await getPool().query(
    'SELECT * FROM price_history WHERE source_id = $1 ORDER BY checked_at DESC LIMIT $2',
    [sourceId, limit]
  );
  return result.rows;
}

async function getProductPriceHistory(productId, since) {
  const result = await getPool().query(
    'SELECT * FROM price_history WHERE product_id = $1 AND checked_at >= $2 ORDER BY checked_at ASC',
    [productId, since]
  );
  return result.rows;
}

// ==================== PRICE CHANGES ====================

async function logPriceChange(sourceId, productId, url, oldPrice, newPrice, currency) {
  await getPool().query(
    'INSERT INTO price_changes (source_id, product_id, url, old_price, new_price, currency) VALUES ($1, $2, $3, $4, $5, $6)',
    [sourceId, productId, url, oldPrice, newPrice, currency]
  );
}

async function getRecentChanges(sinceTimestamp) {
  const result = await getPool().query(
    'SELECT * FROM price_changes WHERE changed_at > $1 ORDER BY changed_at DESC',
    [sinceTimestamp]
  );
  return result.rows;
}

async function markChangeWebhookSent(changeId) {
  const now = new Date().toISOString();
  await getPool().query(
    'UPDATE price_changes SET webhook_sent = true, webhook_sent_at = $1 WHERE id = $2',
    [now, changeId]
  );
}

// ==================== FAILED WEBHOOKS ====================

async function addFailedWebhook(payload) {
  await getPool().query(
    'INSERT INTO failed_webhooks (payload) VALUES ($1)',
    [JSON.stringify(payload)]
  );
}

async function getFailedWebhooks(maxAttempts = 5) {
  const result = await getPool().query(
    'SELECT * FROM failed_webhooks WHERE attempts < $1 ORDER BY created_at ASC',
    [maxAttempts]
  );
  return result.rows;
}

async function incrementWebhookAttempt(webhookId) {
  const now = new Date().toISOString();
  await getPool().query(
    'UPDATE failed_webhooks SET attempts = attempts + 1, last_attempt_at = $1 WHERE id = $2',
    [now, webhookId]
  );
}

async function deleteFailedWebhook(webhookId) {
  await getPool().query('DELETE FROM failed_webhooks WHERE id = $1', [webhookId]);
}

// ==================== JOB QUEUE ====================

async function addToQueue(sourceId, productId, url, handlerKey, priority = 0, nextCheckAt = null) {
  const now = new Date().toISOString();
  nextCheckAt = nextCheckAt || now;

  await getPool().query(`
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
  const now = new Date().toISOString();
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');

    // Get highest priority pending job that's due
    const result = await client.query(`
      SELECT * FROM job_queue
      WHERE status = 'pending' AND next_check_at <= $1
      ORDER BY priority DESC, next_check_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [now]);

    const job = result.rows[0];

    if (job) {
      // Mark as processing
      await client.query(
        'UPDATE job_queue SET status = $1, updated_at = $2 WHERE id = $3',
        ['processing', now, job.id]
      );
    }

    await client.query('COMMIT');
    return job || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function completeJob(jobId, nextCheckAt) {
  const now = new Date().toISOString();
  await getPool().query(
    'UPDATE job_queue SET status = $1, priority = 0, next_check_at = $2, updated_at = $3 WHERE id = $4',
    ['pending', nextCheckAt, now, jobId]
  );
}

async function failJob(jobId, nextCheckAt) {
  const now = new Date().toISOString();
  await getPool().query(
    'UPDATE job_queue SET status = $1, next_check_at = $2, updated_at = $3 WHERE id = $4',
    ['pending', nextCheckAt, now, jobId]
  );
}

async function prioritizeSource(sourceId) {
  const now = new Date().toISOString();
  await getPool().query(
    'UPDATE job_queue SET priority = 100, next_check_at = $1, updated_at = $1 WHERE source_id = $2',
    [now, sourceId]
  );
}

async function getQueueStats() {
  const now = new Date().toISOString();
  const result = await getPool().query(`
    SELECT
      CASE
        WHEN status = 'processing' THEN 'processing'
        WHEN status = 'pending' AND next_check_at <= $1 THEN 'ready'
        ELSE 'scheduled'
      END as status,
      COUNT(*)::int as count,
      AVG(priority)::float as avg_priority
    FROM job_queue
    GROUP BY 1
  `, [now]);
  return result.rows;
}

async function clearQueue() {
  await getPool().query('DELETE FROM job_queue');
}

async function getJobBySourceId(sourceId) {
  const result = await getPool().query(
    'SELECT * FROM job_queue WHERE source_id = $1',
    [sourceId]
  );
  return result.rows[0] || null;
}

async function getJobsWithPrices(limit = 50, offset = 0) {
  const result = await getPool().query(`
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
  const result = await getPool().query('SELECT COUNT(*)::int as count FROM job_queue');
  return result.rows[0]?.count || 0;
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

async function close() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  // Init
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
