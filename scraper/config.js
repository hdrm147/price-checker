/**
 * Scraper service config — slimmed from the legacy node/ codebase.
 * No DB, no scheduler, no SSH tunnels. Just enough to launch Chromium
 * and accept HTTP requests.
 */
module.exports = {
  api: {
    port: parseInt(process.env.SCRAPER_PORT || '3000', 10),
  },

  // Optional global proxy (e.g., socks5://localhost:1080). When set, handlers
  // declaring `proxy: 'auto'` or `'residential'` route through it; handlers
  // declaring `proxy: 'direct'` always exit via the host's normal network.
  // When unset, all handlers exit direct regardless of declaration.
  proxy: process.env.SCRAPER_PROXY || null,

  workers: {
    // Per-pool size. We may instantiate two pools (proxied + direct) if both
    // routing modes are exercised, so keep this conservative.
    count: parseInt(process.env.SCRAPER_POOL_SIZE || '2', 10),
    headless: process.env.BROWSER_HEADLESS !== 'false',
  },

  delays: {
    afterCloudflareMs: 2000,
    pageLoadTimeoutMs: 30000,
  },
};
