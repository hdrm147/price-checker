/**
 * PostgreSQL Database Adapter
 */
const { Pool } = require('pg');
const BaseAdapter = require('./base');

class PostgresAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.pool = null;      // Price Server DB
    this.mainPool = null;  // Main Backend DB
  }

  async connect() {
    // Price Server database pool
    this.pool = new Pool({
      host: this.config.postgres.host,
      port: this.config.postgres.port,
      database: this.config.postgres.database,
      user: this.config.postgres.user,
      password: this.config.postgres.password,
    });

    // Main Backend database pool
    this.mainPool = new Pool({
      host: this.config.mainDb.host,
      port: this.config.mainDb.port,
      database: this.config.mainDb.database,
      user: this.config.mainDb.user,
      password: this.config.mainDb.password,
    });

    console.log('[postgres] Connected to databases');
  }

  async initSchema() {
    if (this.initialized) return;

    const client = await this.pool.connect();
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
      this.initialized = true;
      console.log('[postgres] Schema initialized');
    } finally {
      client.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.mainPool) {
      await this.mainPool.end();
      this.mainPool = null;
    }
    console.log('[postgres] Connections closed');
  }

  async query(sql, params = []) {
    return this.pool.query(sql, params);
  }

  async mainQuery(sql, params = []) {
    return this.mainPool.query(sql, params);
  }

  async getTransactionClient() {
    const client = await this.pool.connect();
    return {
      client,
      query: (sql, params) => client.query(sql, params),
      begin: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
      release: () => client.release(),
    };
  }

  async getNextJobWithLock(domainFilter = '') {
    const now = new Date().toISOString();
    const txn = await this.getTransactionClient();

    try {
      await txn.begin();

      // Get highest priority pending job that's due (filtered by domain mode)
      const result = await txn.query(`
        SELECT * FROM job_queue
        WHERE status = 'pending' AND next_check_at <= $1
        ${domainFilter}
        ORDER BY priority DESC, next_check_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `, [now]);

      const job = result.rows[0];

      if (job) {
        // Mark as processing
        await txn.query(
          'UPDATE job_queue SET status = $1, updated_at = $2 WHERE id = $3',
          ['processing', now, job.id]
        );
      }

      await txn.commit();
      return job || null;
    } catch (err) {
      await txn.rollback();
      throw err;
    } finally {
      txn.release();
    }
  }

  translatePlaceholders(sql) {
    // PostgreSQL uses $1, $2, etc. - no translation needed
    return sql;
  }

  getSqlFragments() {
    return {
      autoIncrement: 'BIGSERIAL PRIMARY KEY',
      timestamp: 'TIMESTAMPTZ',
      json: 'JSONB',
      now: 'NOW()',
      castInt: (expr) => `${expr}::int`,
      greatest: (a, b) => `GREATEST(${a}, ${b})`,
      least: (a, b) => `LEAST(${a}, ${b})`,
      nullsFirst: 'NULLS FIRST',
    };
  }
}

module.exports = PostgresAdapter;
