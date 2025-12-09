const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Format: 145.000 IQD (uses . as thousands separator)
  const priceEl = $('.price').first();

  if (priceEl.length) {
    const priceText = priceEl.text().trim();
    // Remove "Sale price" text and extract number
    // 145.000 IQD -> 145000
    const match = priceText.match(/(\d{1,3}(?:\.\d{3})+|\d+)\s*IQD/i);
    if (match) {
      const cleaned = match[1].replace(/\./g, '');
      console.log(`TT-Tab price: ${priceText.replace(/\s+/g, ' ')} -> cleaned: ${cleaned}`);
      return { price: cleaned, currency: 'IQD', raw: priceText };
    }
  }

  // Fallback: try meta tag
  const metaPrice = $('meta[property="og:price:amount"]').attr('content');
  if (metaPrice) {
    const cleaned = metaPrice.replace(/[^\d]/g, '');
    if (cleaned) {
      console.log(`TT-Tab meta price: ${metaPrice} -> cleaned: ${cleaned}`);
      return { price: cleaned, currency: 'IQD', raw: metaPrice };
    }
  }

  console.log('TT-Tab: No price found');
  return null;
}

module.exports = { extractPrice };