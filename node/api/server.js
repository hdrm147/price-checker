const express = require('express');
const config = require('../config');
const db = require('../db/postgres');
const { requestPriceCheck } = require('../workers/PriceChecker');
const { getPool } = require('../browser/BrowserPool');

const app = express();
app.use(express.json());

// CORS for Nova package
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-API-Key');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// API Key Authentication Middleware
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = config.api.secret;

  // Skip auth if no secret is configured or if it's a health check
  if (!expectedKey || req.path === '/health') {
    return next();
  }

  if (!apiKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }

  next();
};

// Apply API key auth to /api/* routes
app.use('/api', apiKeyAuth);

// Request logging
app.use((req, res, next) => {
  if (!req.url.startsWith('/assets')) {
    console.log(`[API] ${req.method} ${req.url}`);
  }
  next();
});

// ==================== API ENDPOINTS ====================

/**
 * Health check
 */
app.get('/health', async (req, res) => {
  const browserStats = getPool().getStats();
  const queueStats = await db.getQueueStats();

  res.json({
    status: 'ok',
    browsers: browserStats,
    queue: queueStats,
  });
});

/**
 * Get products list
 */
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getProductsWithSources();
    res.json({ products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get price comparison data grouped by product
 * This is the main endpoint for the Nova UI
 */
app.get('/api/comparison', async (req, res) => {
  try {
    const productIdsParam = req.query.product_ids;
    const singleProductId = req.query.product_id;
    let productIds = null;

    if (singleProductId) {
      productIds = [parseInt(singleProductId)];
    } else if (productIdsParam) {
      productIds = productIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    }

    // Get all products with price sources
    let products = await db.getProductsWithSources();

    // Filter by product IDs if provided
    if (productIds && productIds.length > 0) {
      products = products.filter(p => productIds.includes(p.id));
    }

    // For each product, get all prices from PostgreSQL
    const comparisonData = [];
    for (const product of products) {
      const prices = await db.getPriceByProduct(product.id);

      // Get source info for each price
      const sources = await db.getPriceSourcesByProduct(product.id);
      const sourceMap = new Map(sources.map(s => [s.source_id, s]));

      const competitors = prices.map(price => {
        const source = sourceMap.get(price.source_id);
        return {
          source_id: price.source_id,
          store_name: source?.store_name || null,
          domain: source?.domain || (price.url ? new URL(price.url).hostname.replace('www.', '') : 'Unknown'),
          price: parseFloat(price.price),
          currency: price.currency,
          raw_price: price.raw_price,
          in_stock: price.in_stock !== false,
          checked_at: price.checked_at,
        };
      });

      comparisonData.push({
        product_id: product.id,
        product_name: product.name_en,
        sku: product.sku,
        our_price: parseFloat(product.price),
        competitors: competitors.sort((a, b) => (a.price || Infinity) - (b.price || Infinity)),
      });
    }

    res.json({ data: comparisonData });
  } catch (error) {
    console.error('Comparison error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent price changes
 */
app.get('/api/changes', async (req, res) => {
  try {
    const since = req.query.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const changes = await db.getRecentChanges(since);

    // Enrich with product and source info
    const productIds = [...new Set(changes.map(c => c.product_id))];
    const products = await db.getProductsByIds(productIds);
    const productMap = new Map(products.map(p => [p.id, p]));

    const enrichedChanges = changes.map(change => ({
      ...change,
      product: productMap.get(change.product_id) || null,
      source: {
        domain: change.url ? new URL(change.url).hostname.replace('www.', '') : 'Unknown',
      },
    }));

    res.json({ changes: enrichedChanges, since });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get jobs list with enriched product data
 */
app.get('/api/jobs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const jobs = await db.getJobsWithPrices(limit, offset);
    const totalJobs = await db.getJobCount();

    // Get product info from PostgreSQL
    const productIds = [...new Set(jobs.map(j => j.product_id))];
    const products = await db.getProductsByIds(productIds);
    const productMap = new Map(products.map(p => [String(p.id), p]));

    const jobsWithProducts = jobs.map(job => ({
      ...job,
      product_name: productMap.get(String(job.product_id))?.name_en || null,
      sku: productMap.get(String(job.product_id))?.sku || null,
      domain: job.url ? new URL(job.url).hostname.replace('www.', '') : null
    }));

    res.json({
      jobs: jobsWithProducts,
      total: totalJobs,
      limit,
      offset
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get price history for a product (all sources)
 */
app.get('/api/history/product/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const range = req.query.range || '7d';

    // Calculate date range
    const now = new Date();
    let since;
    switch (range) {
      case '24h': since = new Date(now - 24 * 60 * 60 * 1000); break;
      case '7d': since = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': since = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': since = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
      default: since = new Date(now - 7 * 24 * 60 * 60 * 1000);
    }

    const history = await db.getProductPriceHistory(productId, since.toISOString());
    const prices = await db.getPriceByProduct(productId);

    // Group by source
    const sourceMap = new Map();
    for (const h of history) {
      if (!sourceMap.has(h.source_id)) {
        const price = prices.find(p => p.source_id === h.source_id);
        sourceMap.set(h.source_id, {
          source_id: h.source_id,
          domain: price?.url ? new URL(price.url).hostname.replace('www.', '') : 'Unknown',
          currency: price?.currency || 'IQD',
          latest_price: price?.price,
          history: []
        });
      }
      sourceMap.get(h.source_id).history.push(h);
    }

    res.json({
      product_id: productId,
      sources: Array.from(sourceMap.values())
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get price comparison for a product
 */
app.get('/api/compare/product/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);

    const product = await db.getProduct(productId);
    const prices = await db.getPriceByProduct(productId);

    // Add domain to each price and sort by price
    const pricesWithDomain = prices
      .map(p => ({
        ...p,
        domain: p.url ? new URL(p.url).hostname.replace('www.', '') : 'Unknown'
      }))
      .sort((a, b) => (parseFloat(a.price) || Infinity) - (parseFloat(b.price) || Infinity));

    res.json({
      product: {
        id: product?.id,
        sku: product?.sku,
        name_en: product?.name_en,
        our_price: product?.price
      },
      prices: pricesWithDomain
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get price for a specific source
 */
app.get('/price/source/:sourceId', async (req, res) => {
  try {
    const sourceId = parseInt(req.params.sourceId);

    if (isNaN(sourceId)) {
      return res.status(400).json({ error: 'Invalid source ID' });
    }

    const result = await requestPriceCheck(sourceId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all prices for a product (all sources)
 */
app.get('/price/product/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const prices = await db.getPriceByProduct(productId);

    res.json({
      product_id: productId,
      prices,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all current prices (bulk)
 */
app.get('/prices', async (req, res) => {
  try {
    const prices = await db.getAllPrices();
    res.json({ prices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get price changes since a timestamp
 */
app.get('/changes', async (req, res) => {
  try {
    const since = req.query.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const changes = await db.getRecentChanges(since);

    res.json({ changes, since });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get price history for a source
 */
app.get('/history/:sourceId', async (req, res) => {
  try {
    const sourceId = parseInt(req.params.sourceId);
    const limit = parseInt(req.query.limit) || 100;

    const history = await db.getPriceHistory(sourceId, limit);

    res.json({ source_id: sourceId, history });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Force refresh a source (add to high priority queue)
 */
app.post('/refresh/:sourceId', async (req, res) => {
  try {
    const sourceId = parseInt(req.params.sourceId);

    // Get source info from postgres
    const source = await db.getPriceSource(sourceId);
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Add to high priority queue
    await db.addToQueue(
      source.source_id,
      source.product_id,
      source.url,
      source.handler_key,
      100 // High priority
    );

    res.json({ message: 'Queued for refresh', source_id: sourceId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Force refresh all sources for a product (add to high priority queue)
 */
app.post('/refresh/product/:productId', async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);

    // Get all sources for this product
    const sources = await db.getPriceSourcesByProduct(productId);
    if (!sources || sources.length === 0) {
      return res.status(404).json({ error: 'No sources found for product', product_id: productId });
    }

    // Add all sources to high priority queue
    let queued = 0;
    for (const source of sources) {
      await db.addToQueue(
        source.source_id,
        productId,
        source.url,
        source.handler_key,
        100 // High priority
      );
      queued++;
    }

    res.json({
      message: `Queued ${queued} sources for refresh`,
      product_id: productId,
      sources_queued: queued
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get queue stats
 */
app.get('/queue/stats', async (req, res) => {
  try {
    const stats = await db.getQueueStats();
    const browserStats = getPool().getStats();

    res.json({ queue: stats, browsers: browserStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger manual product sync from main database
 */
app.post('/sync', async (req, res) => {
  try {
    const { syncProducts } = require('../scheduler/Scheduler');
    await syncProducts();

    res.json({ message: 'Sync completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(config.api.port, () => {
      console.log(`API server running on port ${config.api.port}`);
      console.log(`Dashboard available at http://localhost:${config.api.port}/`);
      resolve(server);
    });
  });
}

module.exports = { app, startServer };
