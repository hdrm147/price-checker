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
      const rawText = el.attr('data-price') || el.attr('content') || el.text();

      // Extract just the first price-like pattern from the text
      // This handles cases where extra text like "Unit price / Unavailable" follows
      const priceMatch = rawText.match(/[\d,]+(?:\.\d+)?/);
      if (!priceMatch) continue;

      const priceStr = priceMatch[0];
      // Remove commas for proper number parsing (17,000 -> 17000)
      const cleaned = priceStr.replace(/,/g, '');

      if (cleaned && !isNaN(parseFloat(cleaned))) {
        // Detect currency from text, fallback to default
        let currency = defaultCurrency;
        if (rawText.includes('$') || rawText.includes('USD')) currency = 'USD';
        else if (rawText.includes('TRY') || rawText.includes('TL') || rawText.includes('₺')) currency = 'TRY';
        else if (rawText.includes('€') || rawText.includes('EUR')) currency = 'EUR';
        else if (rawText.includes('£') || rawText.includes('GBP')) currency = 'GBP';

        console.log(`Generic price: ${rawText.trim().substring(0, 50)} -> cleaned: ${cleaned}`);
        return { price: cleaned, currency, raw: priceStr };
      }
    }
  }

  return null;
}

module.exports = { extractPrice };