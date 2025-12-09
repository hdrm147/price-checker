const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Method 1: Main product price (price-sale js-price)
  const salePrice = $('.product-details_price .price-sale.js-price').first().text().trim();
  if (salePrice) {
    return parseAlityanPrice(salePrice);
  }

  // Method 2: Generic price-sale in product-details
  const detailsPrice = $('.product-details .price-sale').first().text().trim();
  if (detailsPrice) {
    return parseAlityanPrice(detailsPrice);
  }

  // Method 3: Any price-sale element
  const anyPrice = $('.price-sale').first().text().trim();
  if (anyPrice) {
    return parseAlityanPrice(anyPrice);
  }

  console.log('Alityan: No price found');
  return null;
}

function parseAlityanPrice(priceText) {
  const raw = priceText;

  // Format: "235.000 IQD" where . is thousands separator
  // Remove currency and clean
  let cleaned = priceText.replace(/IQD/gi, '').trim();

  // Remove dots (thousands separator) to get clean number
  cleaned = cleaned.replace(/\./g, '').replace(/,/g, '');

  console.log('Alityan price:', raw, '-> cleaned:', cleaned);

  return {
    price: cleaned,
    currency: 'IQD',
    raw: raw,
  };
}

module.exports = { extractPrice };