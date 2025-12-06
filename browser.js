const { connect } = require("puppeteer-real-browser");
const fs = require("fs");

let browserInstance = null;
let pageInstance = null;
let isProcessing = false;
const requestQueue = [];

async function initBrowser() {
  if (browserInstance && pageInstance) {
    return { page: pageInstance, browser: browserInstance };
  }

  console.log("Launching browser...");
  const { page, browser } = await connect({
    headless: false,
    turnstile: true,
    fingerprint: true,
    args: ["--start-maximized"],
  });

  browserInstance = browser;
  pageInstance = page;

  return { page, browser };
}

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;

  isProcessing = true;
  const { url, resolve, reject } = requestQueue.shift();

  try {
    const html = await fetchPageInternal(url);
    resolve(html);
  } catch (error) {
    reject(error);
  } finally {
    isProcessing = false;
    processQueue(); // Process next in queue
  }
}

async function setAmazonZipCode(page, zipCode = '19720') {
  try {
    // Check if we need to set the zip code by looking at current location
    const currentLocation = await page.$eval('#glow-ingress-line2', el => el.textContent.trim()).catch(() => null);

    if (currentLocation && currentLocation.includes(zipCode)) {
      console.log(`Amazon zip already set to ${zipCode}`);
      return;
    }

    console.log(`Setting Amazon delivery zip to ${zipCode}...`);

    // Click on the delivery location link
    const locationLink = await page.$('#nav-global-location-popover-link, #glow-ingress-block');
    if (!locationLink) {
      console.log('Amazon location link not found');
      return;
    }

    await locationLink.click();
    await new Promise(r => setTimeout(r, 1500));

    // Wait for the modal to appear
    await page.waitForSelector('#GLUXZipUpdateInput, input[data-action="GLUXPostalInputAction"]', { timeout: 5000 }).catch(() => {});

    // Find and fill the zip code input
    const zipInput = await page.$('#GLUXZipUpdateInput, input[data-action="GLUXPostalInputAction"]');
    if (zipInput) {
      await zipInput.click({ clickCount: 3 }); // Select all
      await zipInput.type(zipCode, { delay: 50 });

      await new Promise(r => setTimeout(r, 500));

      // Click apply button
      const applyBtn = await page.$('#GLUXZipUpdate, [data-action="GLUXPostalUpdateAction"] .a-button-input, #GLUXZipUpdate-announce');
      if (applyBtn) {
        await applyBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }

      // Close any remaining modal
      const doneBtn = await page.$('.a-popover-footer .a-button-primary, [data-action="a-popover-close"]');
      if (doneBtn) {
        await doneBtn.click();
        await new Promise(r => setTimeout(r, 1000));
      }

      console.log(`Amazon zip code set to ${zipCode}`);

      // Reload page to get updated prices
      await page.reload({ waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.log('Amazon zip code setting failed:', e.message);
  }
}

async function fetchPageInternal(url) {
  const { page } = await initBrowser();

  console.log(`Navigating to: ${url}`);
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Wait for Cloudflare if present
  await page.waitForFunction(
    () => !document.body.innerText.includes("Checking your browser"),
    { timeout: 120000 }
  ).catch(() => {});

  await new Promise((r) => setTimeout(r, 2000));

  // Set Amazon zip code if this is an Amazon page
  if (url.includes('amazon.com')) {
    await setAmazonZipCode(page, '19720');
  }

  const html = await page.content();

  // Save HTML for debugging
  fs.writeFileSync("debug-page.html", html);
  console.log("Saved HTML to debug-page.html");

  // Save screenshot for debugging
  await page.screenshot({ path: 'debug-screenshot.png', fullPage: true }).catch(() => {});
  console.log("Saved screenshot to debug-screenshot.png");

  return html;
}

// Queue-based fetchPage to handle concurrent requests
function fetchPage(url) {
  console.log(`Queuing request for: ${url} (queue size: ${requestQueue.length})`);
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, resolve, reject });
    processQueue();
  });
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
    pageInstance = null;
  }
}

module.exports = { initBrowser, fetchPage, closeBrowser };
