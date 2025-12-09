#!/usr/bin/env node

/**
 * Database initialization script for Price Server
 * Creates the required PostgreSQL tables for storing prices
 *
 * Usage: node scripts/init-db.js
 */

require('dotenv').config();

const { Pool } = require('pg');

const config = {
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  database: process.env.PG_DATABASE || 'cyber',
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
};

const pool = new Pool(config);

const createTables = async () => {
  console.log('Connecting to PostgreSQL...');
  console.log(`  Host: ${config.host}:${config.port}`);
  console.log(`  Database: ${config.database}`);

  const client = await pool.connect();

  try {
    console.log('\nCreating tables...\n');

    // Create prices table
    console.log('Creating prices table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS prices (
        id BIGSERIAL PRIMARY KEY,
        source_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        price DECIMAL(12, 2),
        currency VARCHAR(10) DEFAULT 'IQD',
        raw_price VARCHAR(255),
        in_stock BOOLEAN DEFAULT true,
        checked_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_id)
      );

      CREATE INDEX IF NOT EXISTS idx_prices_product ON prices(product_id);
      CREATE INDEX IF NOT EXISTS idx_prices_checked ON prices(checked_at);
    `);
    console.log('  Done.');

    // Create price_history table
    console.log('Creating price_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        id BIGSERIAL PRIMARY KEY,
        source_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        price DECIMAL(12, 2),
        currency VARCHAR(10) DEFAULT 'IQD',
        checked_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_price_history_source ON price_history(source_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_product ON price_history(product_id);
      CREATE INDEX IF NOT EXISTS idx_price_history_checked ON price_history(checked_at);
    `);
    console.log('  Done.');

    // Create price_changes table
    console.log('Creating price_changes table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_changes (
        id BIGSERIAL PRIMARY KEY,
        source_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        url TEXT,
        old_price DECIMAL(12, 2),
        new_price DECIMAL(12, 2),
        currency VARCHAR(10) DEFAULT 'IQD',
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        webhook_sent BOOLEAN DEFAULT false,
        webhook_sent_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_price_changes_product ON price_changes(product_id);
      CREATE INDEX IF NOT EXISTS idx_price_changes_time ON price_changes(changed_at);
    `);
    console.log('  Done.');

    // Create job_queue table
    console.log('Creating job_queue table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS job_queue (
        id BIGSERIAL PRIMARY KEY,
        source_id BIGINT NOT NULL UNIQUE,
        product_id BIGINT NOT NULL,
        url TEXT NOT NULL,
        handler_key TEXT,
        priority INTEGER DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        next_check_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status, priority DESC, next_check_at);
      CREATE INDEX IF NOT EXISTS idx_job_queue_source ON job_queue(source_id);
    `);
    console.log('  Done.');

    // Create failed_webhooks table
    console.log('Creating failed_webhooks table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS failed_webhooks (
        id BIGSERIAL PRIMARY KEY,
        payload JSONB NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('  Done.');

    console.log('\nAll tables created successfully!');

  } finally {
    client.release();
    await pool.end();
  }
};

createTables()
  .then(() => {
    console.log('\nDatabase initialization complete.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\nDatabase initialization failed:', err.message);
    process.exit(1);
  });
