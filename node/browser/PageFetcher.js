const config = require('../config');

/**
 * Handle Amazon CAPTCHA/verification page
 * Clicks "Continue shopping" button if present
 */
async function handleAmazonCaptcha(page) {
  try {
    // Check if we're on a CAPTCHA/verification page
    const pageContent = await page.content();

    if (pageContent.includes('validateCaptcha') || pageContent.includes('Continue shopping')) {
      console.log('Amazon CAPTCHA page detected, clicking Continue shopping...');

      // Try to find and click the Continue shopping button
      const continueBtn = await page.$('form[action*="validateCaptcha"] button[type="submit"], form[action*="validateCaptcha"] .a-button-text');

      if (continueBtn) {
        await continueBtn.click();
        // Wait for navigation to complete
        await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        console.log('Clicked Continue shopping, page reloaded');
        return true;
      }
    }
    return false;
  } catch (e) {
    console.log('Amazon CAPTCHA handling failed:', e.message);
    return false;
  }
}

/**
 * Set Amazon delivery zip code for accurate pricing
 */
async function setAmazonZipCode(page, zipCode = '19720') {
  try {
    const currentLocation = await page.$eval('#glow-ingress-line2', el => el.textContent.trim()).catch(() => null);

    if (currentLocation && currentLocation.includes(zipCode)) {
      return;
    }

    console.log(`Setting Amazon zip to ${zipCode}...`);

    const locationLink = await page.$('#nav-global-location-popover-link, #glow-ingress-block');
    if (!locationLink) return;

    await locationLink.click();

    // Wait for the popup to appear
    await page.waitForSelector('#GLUXZipUpdateInput, input[data-action="GLUXPostalInputAction"]', { timeout: 5000 }).catch(() => {});

    const zipInput = await page.$('#GLUXZipUpdateInput, input[data-action="GLUXPostalInputAction"]');
    if (zipInput) {
      await zipInput.click({ clickCount: 3 });
      await zipInput.type(zipCode, { delay: 30 });

      const applyBtn = await page.$('#GLUXZipUpdate, [data-action="GLUXPostalUpdateAction"] .a-button-input');
      if (applyBtn) {
        await applyBtn.click();
        // Wait for zip to be applied (watch for button state or text change)
        await new Promise(r => setTimeout(r, 500));
      }

      const doneBtn = await page.$('.a-popover-footer .a-button-primary, [data-action="a-popover-close"]');
      if (doneBtn) {
        await doneBtn.click();
      }

      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  } catch (e) {
    console.log('Amazon zip code setting failed:', e.message);
  }
}

/**
 * Wait for Cloudflare challenge to complete
 */
async function waitForCloudflare(page) {
  try {
    await page.waitForFunction(
      () => !document.body.innerText.includes('Checking your browser'),
      { timeout: 120000 }
    );
  } catch (error) {
    console.log('Cloudflare wait timed out or not present');
  }
}

// Sites that need Cloudflare handling
const cloudflareProtectedSites = ['amazon.com', 'newegg.com'];

/**
 * Fetch a page using a browser instance
 */
async function fetchPage(browserInstance, url) {
  const { page } = browserInstance;

  console.log(`[Browser ${browserInstance.id}] Navigating to: ${url}`);

  const isCloudflareProtected = cloudflareProtectedSites.some(site => url.includes(site));

  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: config.delays.pageLoadTimeoutMs,
  });

  // Only wait for Cloudflare on protected sites
  if (isCloudflareProtected) {
    await waitForCloudflare(page);
    await new Promise(r => setTimeout(r, config.delays.afterCloudflareMs));
  } else {
    // Quick 300ms settle for local sites
    await new Promise(r => setTimeout(r, 300));
  }

  // Handle Amazon-specific setup
  if (url.includes('amazon.com')) {
    const captchaHandled = await handleAmazonCaptcha(page);
    if (captchaHandled) {
      await handleAmazonCaptcha(page);
    }
    await setAmazonZipCode(page, '19720');
  }

  const html = await page.content();

  return html;
}

module.exports = { fetchPage, setAmazonZipCode, waitForCloudflare, handleAmazonCaptcha };
