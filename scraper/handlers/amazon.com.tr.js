const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Method 1: Main product price from corePrice section (a-offscreen contains full price)
  const corePriceOffscreen = $('#corePrice_desktop .a-offscreen').first().text().trim();
  if (corePriceOffscreen) {
    return parseAmazonPrice(corePriceOffscreen);
  }

  // Method 2: Try corePriceDisplay section
  const corePriceDisplay = $('#corePriceDisplay_desktop_feature_div .a-offscreen').first().text().trim();
  if (corePriceDisplay) {
    return parseAmazonPrice(corePriceDisplay);
  }

  // Method 3: Try price block with a-price class
  const priceBlock = $('.a-price .a-offscreen').first().text().trim();
  if (priceBlock) {
    return parseAmazonPrice(priceBlock);
  }

  // Method 4: Combine whole and fraction parts
  const priceWhole = $('.a-price-whole').first().text().replace(/[.,]$/, '').trim();
  const priceFraction = $('.a-price-fraction').first().text().trim();
  const priceSymbol = $('.a-price-symbol').first().text().trim();

  if (priceWhole) {
    const combined = priceFraction ? `${priceWhole},${priceFraction}` : priceWhole;
    return parseAmazonPrice(combined + (priceSymbol || 'TL'));
  }

  // Method 5: Try buybox price
  const buyboxPrice = $('#price_inside_buybox, #priceblock_ourprice, #priceblock_dealprice').first().text().trim();
  if (buyboxPrice) {
    return parseAmazonPrice(buyboxPrice);
  }

  console.log('Amazon: No price found - product may be unavailable');
  return null;
}

function parseAmazonPrice(priceText) {
  // Amazon Turkey format: "19.723,13TL" or "1.299,00 TL"
  // Thousands separator: . (dot)
  // Decimal separator: , (comma)

  const raw = priceText;

  // Extract currency (TL, TRY, or default to TRY)
  let currency = 'TRY';
  if (priceText.includes('TL')) {
    currency = 'TRY';
  }

  // Remove currency symbol and spaces
  let cleaned = priceText.replace(/TL|TRY|₺/gi, '').trim();

  // Turkish format: 19.723,13 -> 19723.13
  // Remove thousand separators (dots) and convert decimal comma to dot
  cleaned = cleaned.replace(/\./g, '').replace(',', '.');

  // Remove any remaining non-numeric chars except decimal point
  cleaned = cleaned.replace(/[^\d.]/g, '');

  console.log('Amazon price found:', raw, '-> cleaned:', cleaned, 'Currency:', currency);

  return {
    price: cleaned,
    currency: currency,
    raw: raw,
  };
}

module.exports = { extractPrice };