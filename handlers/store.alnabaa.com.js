const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Method 1: Regular price item
  const regularPrice = $('.f-price-item.f-price-item--regular').first().text().trim();
  if (regularPrice) {
    return parseAlnabaaPrice(regularPrice);
  }

  // Method 2: Sale price item
  const salePrice = $('.f-price-item.f-price-item--sale').first().text().trim();
  if (salePrice) {
    return parseAlnabaaPrice(salePrice);
  }

  // Method 3: Any f-price-item
  const anyPrice = $('.f-price-item').first().text().trim();
  if (anyPrice) {
    return parseAlnabaaPrice(anyPrice);
  }

  console.log('Alnabaa: No price found');
  return null;
}

function parseAlnabaaPrice(priceText) {
  const raw = priceText;

  // Format: "129,000 IQD" where , is thousands separator
  let cleaned = priceText.replace(/IQD/gi, '').trim();
  cleaned = cleaned.replace(/,/g, '');

  console.log('Alnabaa price:', raw, '-> cleaned:', cleaned);

  return {
    price: cleaned,
    currency: 'IQD',
    raw: raw,
  };
}

module.exports = { extractPrice };