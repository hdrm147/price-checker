const { connect } = require('puppeteer-real-browser');
const config = require('../config');

class BrowserPool {
  constructor(size = config.workers.count) {
    this.size = size;
    this.browsers = [];
    this.available = [];
    this.waiting = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    console.log(`Initializing browser pool with ${this.size} browsers...`);

    for (let i = 0; i < this.size; i++) {
      try {
        const instance = await this.createBrowser(i);
        this.browsers.push(instance);
        this.available.push(instance);
        console.log(`Browser ${i + 1}/${this.size} ready`);
      } catch (error) {
        console.error(`Failed to create browser ${i + 1}:`, error.message);
      }
    }

    if (this.browsers.length === 0) {
      throw new Error('Failed to create any browser instances');
    }

    this.initialized = true;
    console.log(`Browser pool ready with ${this.browsers.length} browsers`);
  }

  async createBrowser(index) {
    console.log(`[BrowserPool] Creating browser ${index} with headless=${config.workers.headless}`);
    const { page, browser } = await connect({
      headless: config.workers.headless,
      turnstile: true,
      fingerprint: true,
      args: [
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
      ],
    });

    // Set smaller viewport for faster rendering
    await page.setViewport({ width: 800, height: 600 });

    // Block images, CSS, and fonts for faster loading (except Amazon which needs full page)
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const resourceType = req.resourceType();

      // Don't block anything for Amazon - it needs full page to work
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

    return {
      id: index,
      browser,
      page,
      busy: false,
    };
  }

  async acquire() {
    // If there's an available browser, return it
    if (this.available.length > 0) {
      const instance = this.available.pop();

      // Check if browser is still alive
      if (!this.isAlive(instance)) {
        console.log(`[Browser ${instance.id}] Dead, recreating...`);
        try {
          const newInstance = await this.createBrowser(instance.id);
          // Replace in browsers array
          const idx = this.browsers.findIndex(b => b.id === instance.id);
          if (idx >= 0) this.browsers[idx] = newInstance;
          newInstance.busy = true;
          return newInstance;
        } catch (error) {
          console.error(`[Browser ${instance.id}] Failed to recreate:`, error.message);
          // Try next available browser
          return this.acquire();
        }
      }

      instance.busy = true;
      return instance;
    }

    // Otherwise, wait for one to become available
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

    // If someone is waiting, give it to them
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift();
      instance.busy = true;
      resolve(instance);
    } else {
      this.available.push(instance);
    }
  }

  async close() {
    console.log('Closing browser pool...');
    for (const instance of this.browsers) {
      try {
        await instance.browser.close();
      } catch (error) {
        // Ignore close errors
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
    };
  }
}

// Singleton instance
let poolInstance = null;

function getPool() {
  if (!poolInstance) {
    poolInstance = new BrowserPool();
  }
  return poolInstance;
}

module.exports = { BrowserPool, getPool };
