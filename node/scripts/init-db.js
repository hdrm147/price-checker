#!/usr/bin/env node

/**
 * Database initialization script for Price Checker
 * Creates the required tables for storing prices (PostgreSQL or SQLite)
 *
 * Usage:
 *   PROJECT=cyber node scripts/init-db.js
 *   PROJECT=sqella node scripts/init-db.js
 *   npm run init:cyber
 *   npm run init:sqella
 */

const path = require('path');
const fs = require('fs');

// Determine project and load appropriate .env
const project = process.env.PROJECT || 'cyber';
const envFile = `.env.${project}`;
const envPath = path.join(__dirname, '..', envFile);

if (!fs.existsSync(envPath)) {
  console.error(`Error: Environment file not found: ${envFile}`);
  console.error('Available projects: cyber, sqella');
  process.exit(1);
}

require('dotenv').config({ path: envPath });

const config = require('../config');

console.log('===========================================');
console.log(`   DATABASE INIT - ${project.toUpperCase()}`);
console.log('===========================================');
console.log('');

async function initPostgres() {
  const { Pool } = require('pg');

  const pgConfig = {
    host: config.postgres.host,
    port: config.postgres.port,
    database: config.postgres.database,
    user: config.postgres.user,
    password: config.postgres.password,
  };

  console.log('Database Type: PostgreSQL');
  console.log(`Host: ${pgConfig.host}:${pgConfig.port}`);
  console.log(`Database: ${pgConfig.database}`);
  console.log('');

  const pool = new Pool(pgConfig);
  const client = await pool.connect();

  try {
    console.log('Creating tables...');
    console.log('');

    // Create all tables
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

    console.log('  ✓ prices');
    console.log('  ✓ price_history');
    console.log('  ✓ price_changes');
    console.log('  ✓ failed_webhooks');
    console.log('  ✓ job_queue');

  } finally {
    client.release();
    await pool.end();
  }
}

async function initSqlite() {
  const Database = require('better-sqlite3');

  const dbPath = config.sqlite?.database || './data/prices.db';
  const dbDir = path.dirname(dbPath);

  // Ensure directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created directory: ${dbDir}`);
  }

  console.log('Database Type: SQLite');
  console.log(`Database File: ${dbPath}`);
  console.log('');

  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  console.log('Creating tables...');
  console.log('');

  db.exec(`
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

  console.log('  ✓ prices');
  console.log('  ✓ price_history');
  console.log('  ✓ price_changes');
  console.log('  ✓ failed_webhooks');
  console.log('  ✓ job_queue');

  db.close();
}

async function testMainDbConnection() {
  const { Pool } = require('pg');

  const mainConfig = {
    host: config.mainDb.host,
    port: config.mainDb.port,
    database: config.mainDb.database,
    user: config.mainDb.user,
    password: config.mainDb.password,
  };

  console.log('');
  console.log('Testing Main Backend DB connection...');
  console.log(`  Host: ${mainConfig.host}:${mainConfig.port}`);
  console.log(`  Database: ${mainConfig.database}`);

  const pool = new Pool(mainConfig);

  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM competitor_price_sources WHERE is_active = true');
    console.log(`  ✓ Connected! Found ${result.rows[0].count} active price sources`);
  } catch (err) {
    console.log(`  ✗ Connection failed: ${err.message}`);
    console.log('    (This is expected if SSH tunnel is not running)');
  } finally {
    await pool.end();
  }
}

async function main() {
  try {
    const dbType = config.database?.type || 'postgres';

    if (dbType === 'sqlite') {
      await initSqlite();
    } else {
      await initPostgres();
    }

    await testMainDbConnection();

    console.log('');
    console.log('===========================================');
    console.log('   Database initialization complete!');
    console.log('===========================================');
    console.log('');
    console.log(`Next: npm run ${project}`);

  } catch (err) {
    console.error('');
    console.error('Database initialization failed:', err.message);
    console.error('');
    console.error('Make sure:');
    console.error('  1. SSH tunnel is running: npm run tunnel:' + project);
    console.error('  2. Database credentials are correct in .env.' + project);
    process.exit(1);
  }
}

main();
