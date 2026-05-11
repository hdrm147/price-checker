const { connect } = require('puppeteer-real-browser');
const config = require('../config');

/**
 * Pool of warm puppeteer-real-browser instances. Optionally launches each
 * Chromium with --proxy-server=$proxyUrl so vendor traffic exits via the
 * configured SOCKS5 (or HTTP) proxy. When proxyUrl is null, exits direct.
 */
class BrowserPool {
  constructor({ size = config.workers.count, proxyUrl = null } = {}) {
    this.size = size;
    this.proxyUrl = proxyUrl;
    this.browsers = [];
    this.available = [];
    this.waiting = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    const label = this.proxyUrl ? `proxied(${this.proxyUrl})` : 'direct';
    console.log(`[pool ${label}] initializing ${this.size} browsers`);

    for (let i = 0; i < this.size; i++) {
      try {
        const instance = await this.createBrowser(i);
        this.browsers.push(instance);
        this.available.push(instance);
        console.log(`[pool ${label}] browser ${i + 1}/${this.size} ready`);
      } catch (error) {
        console.error(`[pool ${label}] failed to create browser ${i + 1}:`, error.message);
      }
    }

    if (this.browsers.length === 0) {
      throw new Error(`Failed to create any browser instances for pool ${label}`);
    }

    this.initialized = true;
  }

  async createBrowser(index) {
    const args = [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-default-browser-check',
      '--window-size=800,600',
    ];

    if (this.proxyUrl) {
      args.push(`--proxy-server=${this.proxyUrl}`);
    }

    const { page, browser } = await connect({
      headless: config.workers.headless,
      turnstile: true,
      fingerprint: true,
      args,
    });

    await page.setViewport({ width: 800, height: 600 });

    // Block images, CSS, and fonts for faster loading (except Amazon which needs full page).
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const resourceType = req.resourceType();

      if (url.includes('amazon.com')) {
        req.continue();
        return;
      }

      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    return { id: index, browser, page, busy: false, proxyUrl: this.proxyUrl };
  }

  async acquire() {
    if (this.available.length > 0) {
      const instance = this.available.pop();

      if (!this.isAlive(instance)) {
        console.log(`[pool] browser ${instance.id} dead, recreating`);
        try {
          const newInstance = await this.createBrowser(instance.id);
          const idx = this.browsers.findIndex((b) => b.id === instance.id);
          if (idx >= 0) this.browsers[idx] = newInstance;
          newInstance.busy = true;
          return newInstance;
        } catch (error) {
          console.error(`[pool] failed to recreate browser ${instance.id}:`, error.message);
          return this.acquire();
        }
      }

      instance.busy = true;
      return instance;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  isAlive(instance) {
    try {
      return instance.browser.isConnected() && !instance.page.isClosed();
    } catch {
      return false;
    }
  }

  release(instance) {
    instance.busy = false;

    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      instance.busy = true;
      resolve(instance);
    } else {
      this.available.push(instance);
    }
  }

  async close() {
    for (const instance of this.browsers) {
      try {
        await instance.browser.close();
      } catch {
        // best effort
      }
    }
    this.browsers = [];
    this.available = [];
    this.initialized = false;
  }

  getStats() {
    return {
      total: this.browsers.length,
      available: this.available.length,
      busy: this.browsers.length - this.available.length,
      waiting: this.waiting.length,
      proxy: this.proxyUrl ?? 'direct',
    };
  }
}

module.exports = { BrowserPool };
