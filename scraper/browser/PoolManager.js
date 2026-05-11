const { BrowserPool } = require('./BrowserPool');

/**
 * Maintains separate BrowserPool instances per outbound routing mode.
 * Pools are created lazily on first acquire so an unused mode pays no
 * Chromium-launch cost.
 *
 * Keys:
 *   'direct'                    — no --proxy-server; exits via host network
 *   'socks5://host:port' (etc.) — Chromium launched with that --proxy-server
 */
class PoolManager {
  constructor() {
    this.pools = new Map();
  }

  async getPool(proxyUrl = null) {
    const key = proxyUrl ?? 'direct';

    if (!this.pools.has(key)) {
      const pool = new BrowserPool({ proxyUrl });
      await pool.init();
      this.pools.set(key, pool);
    }

    return this.pools.get(key);
  }

  async closeAll() {
    for (const pool of this.pools.values()) {
      try {
        await pool.close();
      } catch {
        // best effort
      }
    }
    this.pools.clear();
  }

  stats() {
    return Array.from(this.pools.entries()).map(([key, pool]) => ({
      mode: key,
      ...pool.getStats(),
    }));
  }
}

let instance = null;

function getPoolManager() {
  if (!instance) {
    instance = new PoolManager();
  }
  return instance;
}

module.exports = { PoolManager, getPoolManager };
