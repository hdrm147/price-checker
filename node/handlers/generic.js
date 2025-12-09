const cheerio = require('cheerio');

// International domains that use non-IQD currencies
const internationalDomains = ['amazon.com', 'amazon.com.tr', 'newegg.com'];

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Determine default currency based on domain
  let defaultCurrency = 'IQD'; // Local Iraqi stores default to IQD
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    if (internationalDomains.some(d => hostname.includes(d))) {
      defaultCurrency = 'USD';
    }
  } catch (e) {}

  // Common price selectors (including custom elements like <sale-price>)
  const priceSelectors = [
    'sale-price',           // Custom element (GlobalIraq, etc.)
    'price-list sale-price',
    '[data-price]',
    '.price',
    '.product-price',
    '.product-info__price',
    '#price',
    '[itemprop="price"]',
    '.current-price',
    '.sale-price',
    '.price-item',
    '.price__current',
  ];

  for (const selector of priceSelectors) {
    const el = $(selector).first();
    if (el.length) {
      const price = el.attr('data-price') || el.attr('content') || el.text();
      const cleaned = price.replace(/[^\d.,]/g, '');
      if (cleaned) {
        // Detect currency from text, fallback to default
        let currency = defaultCurrency;
        if (price.includes('$') || price.includes('USD')) currency = 'USD';
        else if (price.includes('TRY') || price.includes('TL') || price.includes('₺')) currency = 'TRY';
        else if (price.includes('€') || price.includes('EUR')) currency = 'EUR';
        else if (price.includes('£') || price.includes('GBP')) currency = 'GBP';

        console.log(`Generic price: ${price.trim()} -> cleaned: ${cleaned}`);
        return { price: cleaned, currency, raw: price.trim() };
      }
    }
  }

  return null;
}

module.exports = { extractPrice };