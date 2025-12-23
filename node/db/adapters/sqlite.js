/**
 * SQLite Database Adapter
 *
 * Provides SQLite support with syntax translations from PostgreSQL:
 * - BIGSERIAL → INTEGER PRIMARY KEY AUTOINCREMENT
 * - TIMESTAMPTZ → TEXT (ISO-8601 format)
 * - JSONB → TEXT (JSON string)
 * - FOR UPDATE SKIP LOCKED → polling with lock column
 * - GREATEST/LEAST → CASE expressions
 * - $1,$2 placeholders → ? placeholders
 * - ::int → CAST(... AS INTEGER)
 */
const Database = require('better-sqlite3');
const BaseAdapter = require('./base');

class SQLiteAdapter extends BaseAdapter {
  constructor(config) {
    super(config);
    this.db = null;       // Price Server DB (SQLite)
    this.mainPool = null; // Main Backend DB (PostgreSQL - always)
    this.lockTimeout = 5000; // 5 second lock timeout
  }

  async connect() {
    const dbPath = this.config.sqlite?.database || ':memory:';

    this.db = new Database(dbPath, {
      verbose: this.config.sqlite?.verbose ? console.log : null,
    });

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    // Main Backend still uses PostgreSQL
    if (this.config.mainDb) {
      const { Pool } = require('pg');
      this.mainPool = new Pool({
        host: this.config.mainDb.host,
        port: this.config.mainDb.port,
        database: this.config.mainDb.database,
        user: this.config.mainDb.user,
        password: this.config.mainDb.password,
      });
    }

    console.log(`[sqlite] Connected to ${dbPath}`);
  }

  async initSchema() {
    if (this.initialized) return;

    this.db.exec(`
      -- Current prices (latest price per source)
      CREATE TABLE IF NOT EXISTS prices (
        source_id INTEGER PRIMARY KEY,
        product_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        handler_key TEXT,
        price REAL,
        currency TEXT DEFAULT 'IQD',
        raw_price TEXT,
        in_stock INTEGER DEFAULT 1,
        checked_at TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Price history for trends
      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        price REAL,
        currency TEXT DEFAULT 'IQD',
        checked_at TEXT NOT NULL
      );

      -- Price changes log
      CREATE TABLE IF NOT EXISTS price_changes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        url TEXT,
        old_price REAL,
        new_price REAL,
        currency TEXT DEFAULT 'IQD',
        changed_at TEXT DEFAULT (datetime('now')),
        webhook_sent INTEGER DEFAULT 0,
        webhook_sent_at TEXT
      );

      -- Failed webhooks for retry
      CREATE TABLE IF NOT EXISTS failed_webhooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payload TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Job queue for scheduling
      CREATE TABLE IF NOT EXISTS job_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL UNIQUE,
        product_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        handler_key TEXT,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        locked_at TEXT,
        locked_by TEXT,
        next_check_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
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
      CREATE INDEX IF NOT EXISTS idx_queue_lock ON job_queue(locked_at);
    `);

    this.initialized = true;
    console.log('[sqlite] Schema initialized');
  }

  async close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    if (this.mainPool) {
      await this.mainPool.end();
      this.mainPool = null;
    }
    console.log('[sqlite] Connections closed');
  }

  async query(sql, params = []) {
    const translatedSql = this.translatePlaceholders(sql);
    const translatedParams = this.translateParams(params);

    // Detect query type
    const isSelect = translatedSql.trim().toUpperCase().startsWith('SELECT');
    const isInsertReturning = /RETURNING/i.test(translatedSql);

    try {
      if (isSelect) {
        const rows = this.db.prepare(translatedSql).all(...translatedParams);
        return { rows: this.convertBooleans(rows) };
      } else if (isInsertReturning) {
        // Handle RETURNING clause by removing it and using lastInsertRowid
        const sqlWithoutReturning = translatedSql.replace(/\s+RETURNING\s+.*/i, '');
        const stmt = this.db.prepare(sqlWithoutReturning);
        const result = stmt.run(...translatedParams);
        return { rows: [{ id: result.lastInsertRowid }] };
      } else {
        const stmt = this.db.prepare(translatedSql);
        const result = stmt.run(...translatedParams);
        return { rows: [], rowCount: result.changes };
      }
    } catch (err) {
      console.error('[sqlite] Query error:', err.message);
      console.error('[sqlite] SQL:', translatedSql);
      console.error('[sqlite] Params:', translatedParams);
      throw err;
    }
  }

  async mainQuery(sql, params = []) {
    // Main backend is always PostgreSQL
    return this.mainPool.query(sql, params);
  }

  async getTransactionClient() {
    const self = this;
    let inTransaction = false;

    return {
      client: this.db,
      query: async (sql, params) => self.query(sql, params),
      begin: () => {
        self.db.exec('BEGIN IMMEDIATE');
        inTransaction = true;
      },
      commit: () => {
        if (inTransaction) {
          self.db.exec('COMMIT');
          inTransaction = false;
        }
      },
      rollback: () => {
        if (inTransaction) {
          self.db.exec('ROLLBACK');
          inTransaction = false;
        }
      },
      release: () => {
        // SQLite doesn't have connection pools, no-op
        if (inTransaction) {
          self.db.exec('ROLLBACK');
        }
      },
    };
  }

  /**
   * SQLite doesn't have FOR UPDATE SKIP LOCKED
   * We use a locking column approach with optimistic locking
   */
  async getNextJobWithLock(domainFilter = '') {
    const now = new Date().toISOString();
    const lockId = `worker_${process.pid}_${Date.now()}`;
    const lockExpiry = new Date(Date.now() - this.lockTimeout).toISOString();

    // Atomically claim an unlocked or expired-lock job
    const updateSql = `
      UPDATE job_queue SET
        status = 'processing',
        locked_at = ?,
        locked_by = ?,
        updated_at = ?
      WHERE id = (
        SELECT id FROM job_queue
        WHERE status = 'pending'
          AND next_check_at <= ?
          AND (locked_at IS NULL OR locked_at < ?)
          ${domainFilter}
        ORDER BY priority DESC, next_check_at ASC
        LIMIT 1
      )
    `;

    const translatedSql = this.translatePlaceholders(updateSql);
    const stmt = this.db.prepare(translatedSql);
    const result = stmt.run(now, lockId, now, now, lockExpiry);

    if (result.changes === 0) {
      return null;
    }

    // Fetch the job we just locked
    const selectSql = 'SELECT * FROM job_queue WHERE locked_by = ?';
    const job = this.db.prepare(selectSql).get(lockId);

    return job ? this.convertBooleans([job])[0] : null;
  }

  /**
   * Convert PostgreSQL $1, $2 placeholders to SQLite ?
   */
  translatePlaceholders(sql) {
    let result = sql;

    // Replace $N with ?
    result = result.replace(/\$\d+/g, '?');

    // Replace ::int and ::float casts
    result = result.replace(/::int\b/gi, '');
    result = result.replace(/::float\b/gi, '');
    result = result.replace(/::integer\b/gi, '');

    // Replace GREATEST(a, b) with MAX(a, b) for SQLite
    result = result.replace(/GREATEST\s*\(\s*([^,]+),\s*([^)]+)\)/gi, 'MAX($1, $2)');

    // Replace LEAST(a, b) with MIN(a, b) for SQLite
    result = result.replace(/LEAST\s*\(\s*([^,]+),\s*([^)]+)\)/gi, 'MIN($1, $2)');

    // Replace NOW() with datetime('now')
    result = result.replace(/NOW\(\)/gi, "datetime('now')");

    // Replace NULLS FIRST with empty (SQLite default)
    result = result.replace(/\s+NULLS\s+FIRST/gi, '');

    // Replace FOR UPDATE SKIP LOCKED (not supported, remove it)
    result = result.replace(/\s+FOR\s+UPDATE\s+SKIP\s+LOCKED/gi, '');
    result = result.replace(/\s+FOR\s+UPDATE/gi, '');

    // Replace JSONB/JSON type operations
    result = result.replace(/::jsonb/gi, '');
    result = result.replace(/::json/gi, '');

    // Replace boolean true/false with 1/0
    result = result.replace(/\btrue\b/gi, '1');
    result = result.replace(/\bfalse\b/gi, '0');

    // Replace ILIKE with LIKE (case insensitive by default in SQLite)
    result = result.replace(/\bILIKE\b/gi, 'LIKE');

    return result;
  }

  /**
   * Convert params for SQLite (booleans to integers, etc.)
   */
  translateParams(params) {
    return params.map(p => {
      if (typeof p === 'boolean') return p ? 1 : 0;
      if (p instanceof Date) return p.toISOString();
      if (typeof p === 'object' && p !== null) return JSON.stringify(p);
      return p;
    });
  }

  /**
   * Convert SQLite integer booleans back to JS booleans
   */
  convertBooleans(rows) {
    const boolColumns = ['in_stock', 'webhook_sent', 'is_active', 'is_international', 'show_in_app'];

    return rows.map(row => {
      const converted = { ...row };
      for (const col of boolColumns) {
        if (col in converted) {
          converted[col] = converted[col] === 1 || converted[col] === true;
        }
      }
      return converted;
    });
  }

  getSqlFragments() {
    return {
      autoIncrement: 'INTEGER PRIMARY KEY AUTOINCREMENT',
      timestamp: 'TEXT',
      json: 'TEXT',
      now: "datetime('now')",
      castInt: (expr) => `CAST(${expr} AS INTEGER)`,
      greatest: (a, b) => `MAX(${a}, ${b})`,
      least: (a, b) => `MIN(${a}, ${b})`,
      nullsFirst: '',
    };
  }
}

module.exports = SQLiteAdapter;
