const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // WooCommerce format: 450,000 د.ع in .woocommerce-Price-amount
  const priceEl = $('.woocommerce-Price-amount bdi, .woocommerce-Price-amount').first();

  if (priceEl.length) {
    const priceText = priceEl.text().trim();
    // Extract numbers, handling Arabic format
    const cleaned = priceText.replace(/[^\d,]/g, '').replace(/,/g, '');

    if (cleaned) {
      console.log(`Alfawaz price: ${priceText} -> cleaned: ${cleaned}`);
      return { price: cleaned, currency: 'IQD', raw: priceText };
    }
  }

  // Fallback: try .price class
  const fallbackEl = $('.price').first();
  if (fallbackEl.length) {
    const priceText = fallbackEl.text().trim();
    const match = priceText.match(/[\d,]+/);
    if (match) {
      const cleaned = match[0].replace(/,/g, '');
      console.log(`Alfawaz fallback price: ${priceText} -> cleaned: ${cleaned}`);
      return { price: cleaned, currency: 'IQD', raw: priceText };
    }
  }

  console.log('Alfawaz: No price found');
  return null;
}

module.exports = { extractPrice };
