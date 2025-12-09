module.exports = {
  // Run mode: 'full' (API + workers), 'api' (API only), 'worker' (workers only)
  mode: process.env.MODE || 'full',

  // Source filtering - set via env: SOURCES=local|international|all
  sources: {
    mode: process.env.SOURCES || 'all', // 'local', 'international', or 'all'
    localDomains: [
      'globaliraq.net', 'kolshzin.com', 'alityan.com', 'store.alnabaa.com', 'anas-iq.com',
      '3d-iraq.com', 'alfarah-store.com', 'alfawaz.com.iq', 'galaxy-iq.com', 'miswag.com', 'mizzostore.com', 'tt-tab.net'
    ],
    internationalDomains: ['amazon.com', 'amazon.com.tr', 'newegg.com'],
  },

  // Main Backend database (has competitor_price_sources, products)
  mainDb: {
    host: process.env.MAIN_DB_HOST || process.env.PG_HOST || 'localhost',
    port: process.env.MAIN_DB_PORT || process.env.PG_PORT || 5432,
    database: process.env.MAIN_DB_NAME || 'cyber',
    user: process.env.MAIN_DB_USER || process.env.PG_USER,
    password: process.env.MAIN_DB_PASSWORD || process.env.PG_PASSWORD,
  },

  // Price Server database (has prices, job_queue, price_history, etc.)
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || 5432,
    database: process.env.PG_DATABASE || 'cyber_prices',
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
  },

  // Webhook to main server on price change
  webhook: {
    url: process.env.WEBHOOK_URL || 'http://localhost:8000/api/webhook/price-change',
    secret: process.env.WEBHOOK_SECRET || '',
    retryAttempts: 5,
    retryDelayMs: 60000, // 1 minute
  },

  // Worker configuration
  workers: {
    count: parseInt(process.env.WORKER_COUNT) || 5,
    headless: process.env.HEADLESS === 'true',
  },

  // Scheduling
  schedule: {
    defaultIntervalSeconds: parseInt(process.env.CHECK_INTERVAL) || 6 * 60 * 60, // 6 hours
    freshnessThresholdSeconds: parseInt(process.env.FRESHNESS_THRESHOLD) || 30 * 60, // 30 minutes
    productSyncIntervalMs: parseInt(process.env.PRODUCT_SYNC_INTERVAL) || 60 * 60 * 1000, // 1 hour
  },

  // API server
  api: {
    port: parseInt(process.env.API_PORT) || 3003,
    secret: process.env.API_SECRET || '', // API key for authentication
  },

  // Request delays to avoid rate limiting
  delays: {
    betweenRequestsMs: parseInt(process.env.DELAY_BETWEEN_REQUESTS) || 2000,
    afterCloudflareMs: 2000,
    pageLoadTimeoutMs: 30000, // Fail fast on slow pages
  },
};
