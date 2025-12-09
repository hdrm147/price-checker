const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Method 1: Product price out-price
  const outPrice = $('.product-price .out-price').first().text().trim();
  if (outPrice) {
    return parseAnasPrice(outPrice);
  }

  // Method 2: Direct out-price
  const directOutPrice = $('.out-price').first().text().trim();
  if (directOutPrice) {
    return parseAnasPrice(directOutPrice);
  }

  // Method 3: Product price div
  const productPrice = $('.product-price').first().text().trim();
  if (productPrice) {
    return parseAnasPrice(productPrice);
  }

  console.log('Anas-IQ: No price found');
  return null;
}

function parseAnasPrice(priceText) {
  const raw = priceText;

  // Format: "960,000 IQD" where , is thousands separator
  let cleaned = priceText.replace(/IQD/gi, '').trim();
  cleaned = cleaned.replace(/,/g, '');

  console.log('Anas-IQ price:', raw, '-> cleaned:', cleaned);

  return {
    price: cleaned,
    currency: 'IQD',
    raw: raw,
  };
}

module.exports = { extractPrice };