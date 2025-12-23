const config = require('../config');
const db = require('../db');

/**
 * Send price change notification to main server
 */
async function notifyPriceChange(change) {
  const { url, secret } = config.webhook;

  if (!url) {
    console.log('Webhook URL not configured, skipping notification');
    return false;
  }

  const payload = {
    source_id: change.source_id,
    product_id: change.product_id,
    url: change.url,
    old_price: change.old_price,
    new_price: change.new_price,
    currency: change.currency,
    changed_at: change.changed_at || new Date().toISOString(),
  };

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (secret) {
      headers['X-Webhook-Secret'] = secret;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log(`Webhook sent: product ${change.product_id} price changed ${change.old_price} -> ${change.new_price}`);
    return true;
  } catch (error) {
    console.error(`Webhook failed: ${error.message}`);

    // Queue for retry
    await db.addFailedWebhook(payload);

    return false;
  }
}

/**
 * Retry failed webhooks
 */
async function retryFailedWebhooks() {
  const failed = await db.getFailedWebhooks(config.webhook.retryAttempts);

  if (failed.length === 0) return;

  console.log(`Retrying ${failed.length} failed webhooks...`);

  for (const webhook of failed) {
    try {
      const payload = typeof webhook.payload === 'string' ? JSON.parse(webhook.payload) : webhook.payload;

      const headers = {
        'Content-Type': 'application/json',
      };

      if (config.webhook.secret) {
        headers['X-Webhook-Secret'] = config.webhook.secret;
      }

      const response = await fetch(config.webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        await db.deleteFailedWebhook(webhook.id);
        console.log(`Retry succeeded for webhook ${webhook.id}`);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      await db.incrementWebhookAttempt(webhook.id);
      console.log(`Retry ${webhook.attempts + 1} failed for webhook ${webhook.id}: ${error.message}`);
    }
  }
}

/**
 * Start webhook retry loop
 */
function startRetryLoop() {
  setInterval(retryFailedWebhooks, config.webhook.retryDelayMs);
  console.log(`Webhook retry loop started (every ${config.webhook.retryDelayMs / 1000}s)`);
}

module.exports = { notifyPriceChange, retryFailedWebhooks, startRetryLoop };
