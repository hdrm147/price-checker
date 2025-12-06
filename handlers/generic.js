const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Common price selectors
  const priceSelectors = [
    '[data-price]',
    '.price',
    '.product-price',
    '#price',
    '[itemprop="price"]',
    '.current-price',
    '.sale-price',
  ];

  for (const selector of priceSelectors) {
    const el = $(selector).first();
    if (el.length) {
      const price = el.attr('data-price') || el.attr('content') || el.text();
      const cleaned = price.replace(/[^\d.,]/g, '');
      if (cleaned) {
        return { price: cleaned, currency: 'USD', raw: price.trim() };
      }
    }
  }

  return null;
}

module.exports = { extractPrice };