/**
 * Base Database Adapter Interface
 * All database adapters must implement these methods
 */
class BaseAdapter {
  constructor(config) {
    this.config = config;
    this.initialized = false;
  }

  /**
   * Initialize database connection(s)
   */
  async connect() {
    throw new Error('Method connect() must be implemented');
  }

  /**
   * Initialize schema (create tables, indexes)
   */
  async initSchema() {
    throw new Error('Method initSchema() must be implemented');
  }

  /**
   * Close database connection(s)
   */
  async close() {
    throw new Error('Method close() must be implemented');
  }

  /**
   * Execute a query on the price server database
   * @param {string} sql - SQL query with placeholders
   * @param {array} params - Query parameters
   * @returns {Promise<{rows: array}>}
   */
  async query(sql, params = []) {
    throw new Error('Method query() must be implemented');
  }

  /**
   * Execute a query on the main backend database
   * @param {string} sql - SQL query with placeholders
   * @param {array} params - Query parameters
   * @returns {Promise<{rows: array}>}
   */
  async mainQuery(sql, params = []) {
    throw new Error('Method mainQuery() must be implemented');
  }

  /**
   * Begin a transaction and get a client
   * @returns {Promise<{client: object, release: function}>}
   */
  async getTransactionClient() {
    throw new Error('Method getTransactionClient() must be implemented');
  }

  /**
   * Get the next pending job with row locking (or equivalent)
   * This is database-specific due to locking mechanisms
   * @param {string} domainFilter - Optional SQL filter for domains
   * @returns {Promise<object|null>}
   */
  async getNextJobWithLock(domainFilter = '') {
    throw new Error('Method getNextJobWithLock() must be implemented');
  }

  /**
   * Translate placeholder style for the database
   * PostgreSQL: $1, $2, etc.
   * SQLite: ?, ?, etc.
   * @param {string} sql - SQL with PostgreSQL-style placeholders
   * @returns {string}
   */
  translatePlaceholders(sql) {
    throw new Error('Method translatePlaceholders() must be implemented');
  }

  /**
   * Get database-specific SQL fragments
   */
  getSqlFragments() {
    return {
      // Auto-increment primary key
      autoIncrement: 'BIGSERIAL PRIMARY KEY',
      // Timestamp type
      timestamp: 'TIMESTAMPTZ',
      // JSON type
      json: 'JSONB',
      // Current timestamp
      now: 'NOW()',
      // Cast to integer
      castInt: (expr) => `${expr}::int`,
      // GREATEST function
      greatest: (a, b) => `GREATEST(${a}, ${b})`,
      // LEAST function
      least: (a, b) => `LEAST(${a}, ${b})`,
      // NULLS FIRST ordering
      nullsFirst: 'NULLS FIRST',
    };
  }
}

module.exports = BaseAdapter;
