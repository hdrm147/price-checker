const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Look for the price in .f8pr-price or .price class
  // Format: <span class="old-price">275,000 IQD</span>&nbsp;255,000 IQD
  const priceEl = $('.f8pr-price, .s1pr.price').first();

  if (priceEl.length) {
    // Get full text and remove old price if present
    let priceText = priceEl.text();

    // Remove old price text (everything before the last price)
    // The current price is the last price in the element
    const matches = priceText.match(/[\d,]+(?:\.\d+)?\s*IQD/gi);
    if (matches && matches.length > 0) {
      // Take the last match (current price, not old price)
      const currentPrice = matches[matches.length - 1];
      const cleaned = currentPrice.replace(/[^\d]/g, '');

      if (cleaned) {
        console.log(`Alfarah price: ${currentPrice} -> cleaned: ${cleaned}`);
        return { price: cleaned, currency: 'IQD', raw: currentPrice };
      }
    }
  }

  // Fallback: try meta tag
  const metaPrice = $('meta[property="og:price:amount"]').attr('content');
  if (metaPrice) {
    const cleaned = metaPrice.replace(/[^\d]/g, '');
    if (cleaned) {
      console.log(`Alfarah meta price: ${metaPrice} -> cleaned: ${cleaned}`);
      return { price: cleaned, currency: 'IQD', raw: metaPrice };
    }
  }

  console.log('Alfarah: No price found');
  return null;
}

module.exports = { extractPrice };