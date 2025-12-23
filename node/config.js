module.exports = {
  // Run mode: 'full' (API + workers), 'api' (API only), 'worker' (workers only)
  mode: process.env.MODE || 'full',

  // Database configuration
  // Type: 'postgres' (default) or 'sqlite'
  database: {
    type: process.env.DB_TYPE || 'postgres',
  },

  // Source filtering - set via env: SOURCES=local|international|all
  sources: {
    mode: process.env.SOURCES || 'all', // 'local', 'international', or 'all'
    localDomains: [
      '3d-iraq.com', 'alamani.iq', 'alemanmarket.com', 'alfarah-store.com', 'alfawaz.com.iq',
      'alityan.com', 'anas-iq.com', 'galaxy-iq.com', 'globaliraq.net', 'kolshzin.com',
      'menairq.com', 'miswag.com', 'mizzostore.com', 'store.alnabaa.com', 'toolmart.me',
      'tt-tab.net', 'un4shop.com', 'elryan.com', 'wajidiraq.com',
    ],
    internationalDomains: ['amazon.com', 'amazon.com.tr', 'newegg.com'],
  },

  // Main Backend database (has competitor_price_sources, products)
  // Always PostgreSQL (Laravel backend)
  mainDb: {
    host: process.env.MAIN_DB_HOST || process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.MAIN_DB_PORT || process.env.PG_PORT || '5432', 10),
    database: process.env.MAIN_DB_NAME || 'cyber',
    user: process.env.MAIN_DB_USER || process.env.PG_USER,
    password: process.env.MAIN_DB_PASSWORD || process.env.PG_PASSWORD,
  },

  // Price Server database - PostgreSQL config (has prices, job_queue, price_history, etc.)
  // Used when DB_TYPE=postgres (default)
  postgres: {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DATABASE || 'cyber_prices',
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
  },

  // Price Server database - SQLite config
  // Used when DB_TYPE=sqlite
  sqlite: {
    database: process.env.SQLITE_DATABASE || './data/prices.db',
    verbose: process.env.SQLITE_VERBOSE === 'true',
  },

  // SSH Tunnel configuration for remote database connections
  // Supports both direct SSH config and ~/.ssh/config names
  ssh: {
    enabled: process.env.SSH_ENABLED === 'true',

    // Tunnel for price server database (postgres/sqlite remote)
    // Use either configName OR host/port/user/privateKeyPath
    prices: {
      configName: process.env.SSH_PRICES_CONFIG_NAME, // e.g., 'cyber-server' or 'sqella-server'
      host: process.env.SSH_PRICES_HOST,
      port: parseInt(process.env.SSH_PRICES_PORT || '22', 10),
      user: process.env.SSH_PRICES_USER,
      privateKeyPath: process.env.SSH_PRICES_KEY_PATH,
      localPort: parseInt(process.env.SSH_PRICES_LOCAL_PORT || '15432', 10),
      remoteHost: process.env.SSH_PRICES_REMOTE_HOST || 'localhost',
      remotePort: parseInt(process.env.SSH_PRICES_REMOTE_PORT || '5432', 10),
    },

    // Tunnel for main backend database
    // Use either configName OR host/port/user/privateKeyPath
    main: {
      configName: process.env.SSH_MAIN_CONFIG_NAME, // e.g., 'cyber-server' or 'sqella-server'
      host: process.env.SSH_MAIN_HOST,
      port: parseInt(process.env.SSH_MAIN_PORT || '22', 10),
      user: process.env.SSH_MAIN_USER,
      privateKeyPath: process.env.SSH_MAIN_KEY_PATH,
      localPort: parseInt(process.env.SSH_MAIN_LOCAL_PORT || '15433', 10),
      remoteHost: process.env.SSH_MAIN_REMOTE_HOST || 'localhost',
      remotePort: parseInt(process.env.SSH_MAIN_REMOTE_PORT || '5432', 10),
    },
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
    count: parseInt(process.env.WORKER_COUNT || '5', 10),
    headless: process.env.BROWSER_HEADLESS !== 'false',
  },

  // Scheduling
  schedule: {
    defaultIntervalSeconds: parseInt(process.env.CHECK_INTERVAL || String(6 * 60 * 60), 10), // 6 hours
    freshnessThresholdSeconds: parseInt(process.env.FRESHNESS_THRESHOLD || String(30 * 60), 10), // 30 minutes
    productSyncIntervalMs: parseInt(process.env.PRODUCT_SYNC_INTERVAL || String(60 * 60 * 1000), 10), // 1 hour
  },

  // API server
  api: {
    port: parseInt(process.env.API_PORT || '3003', 10),
    secret: process.env.API_SECRET || '', // API key for authentication
  },

  // Request delays to avoid rate limiting
  delays: {
    betweenRequestsMs: parseInt(process.env.DELAY_BETWEEN_REQUESTS || '2000', 10),
    afterCloudflareMs: 2000,
    pageLoadTimeoutMs: 30000, // Fail fast on slow pages
  },
};