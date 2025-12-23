/**
 * Database Adapter Factory
 *
 * Creates the appropriate database adapter based on configuration.
 *
 * Usage:
 *   const db = require('./db/adapters');
 *   await db.connect();
 *   await db.initSchema();
 *   const result = await db.query('SELECT * FROM prices');
 */
const config = require('../../config');
const PostgresAdapter = require('./postgres');
const SQLiteAdapter = require('./sqlite');

let adapter = null;

/**
 * Create and return the database adapter based on config
 * @returns {BaseAdapter}
 */
function createAdapter() {
  const dbType = config.database?.type || 'postgres';

  switch (dbType) {
    case 'sqlite':
      console.log('[db] Using SQLite adapter');
      return new SQLiteAdapter(config);

    case 'postgres':
    case 'postgresql':
    default:
      console.log('[db] Using PostgreSQL adapter');
      return new PostgresAdapter(config);
  }
}

/**
 * Get or create the adapter singleton
 * @returns {BaseAdapter}
 */
function getAdapter() {
  if (!adapter) {
    adapter = createAdapter();
  }
  return adapter;
}

/**
 * Connect to the database(s)
 */
async function connect() {
  const db = getAdapter();
  await db.connect();
}

/**
 * Initialize database schema
 */
async function initSchema() {
  const db = getAdapter();
  await db.initSchema();
}

/**
 * Close database connection(s)
 */
async function close() {
  if (adapter) {
    await adapter.close();
    adapter = null;
  }
}

/**
 * Execute query on price server database
 */
async function query(sql, params = []) {
  return getAdapter().query(sql, params);
}

/**
 * Execute query on main backend database
 */
async function mainQuery(sql, params = []) {
  return getAdapter().mainQuery(sql, params);
}

/**
 * Get transaction client
 */
async function getTransactionClient() {
  return getAdapter().getTransactionClient();
}

/**
 * Get next job with locking
 */
async function getNextJobWithLock(domainFilter = '') {
  return getAdapter().getNextJobWithLock(domainFilter);
}

/**
 * Translate placeholders for the current adapter
 */
function translatePlaceholders(sql) {
  return getAdapter().translatePlaceholders(sql);
}

/**
 * Get SQL fragments for the current adapter
 */
function getSqlFragments() {
  return getAdapter().getSqlFragments();
}

/**
 * Get the raw adapter instance
 */
function raw() {
  return getAdapter();
}

module.exports = {
  // Lifecycle
  connect,
  initSchema,
  close,
  // Queries
  query,
  mainQuery,
  getTransactionClient,
  getNextJobWithLock,
  // Utils
  translatePlaceholders,
  getSqlFragments,
  raw,
  // Factory
  createAdapter,
  getAdapter,
};
