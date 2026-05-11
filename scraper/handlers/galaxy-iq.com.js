const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Format: ع.د160,000 (Arabic currency symbol before number)
  // Sale price is in .product-sale-price-text
  const saleEl = $('.product-sale-price-text, .price.product-sale-price-text').first();

  if (saleEl.length) {
    const priceText = saleEl.text().trim();
    // Remove Arabic currency symbol (ع.د) and extract number
    const cleaned = priceText.replace(/[^\d,]/g, '').replace(/,/g, '');

    if (cleaned) {
      console.log(`Galaxy-IQ price: ${priceText} -> cleaned: ${cleaned}`);
      return { price: cleaned, currency: 'IQD', raw: priceText };
    }
  }

  // Fallback: try .product_price .price
  const fallbackEl = $('.product_price .price, .product_price span').first();
  if (fallbackEl.length) {
    const priceText = fallbackEl.text().trim();
    const cleaned = priceText.replace(/[^\d,]/g, '').replace(/,/g, '');

    if (cleaned) {
      console.log(`Galaxy-IQ fallback price: ${priceText} -> cleaned: ${cleaned}`);
      return { price: cleaned, currency: 'IQD', raw: priceText };
    }
  }

  console.log('Galaxy-IQ: No price found');
  return null;
}

module.exports = { extractPrice };