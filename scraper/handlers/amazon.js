const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Method 1: priceToPay (reinvented price display) - most common now
  const priceToPay = $('.priceToPay .aok-offscreen, .reinventPricePriceToPayMargin .aok-offscreen').first().text().trim();
  if (priceToPay) {
    return parseAmazonPrice(priceToPay, url);
  }

  // Method 2: Main product price from corePrice section
  const corePriceOffscreen = $('#corePrice_desktop .a-offscreen').first().text().trim();
  if (corePriceOffscreen) {
    return parseAmazonPrice(corePriceOffscreen, url);
  }

  // Method 3: corePriceDisplay section
  const corePriceDisplay = $('#corePriceDisplay_desktop_feature_div .a-offscreen').first().text().trim();
  if (corePriceDisplay) {
    return parseAmazonPrice(corePriceDisplay, url);
  }

  // Method 3: apex_desktop price block
  const apexPrice = $('#apex_desktop .a-price .a-offscreen').first().text().trim();
  if (apexPrice) {
    return parseAmazonPrice(apexPrice, url);
  }

  // Method 4: Generic price block
  const priceBlock = $('.a-price .a-offscreen').first().text().trim();
  if (priceBlock) {
    return parseAmazonPrice(priceBlock, url);
  }

  // Method 5: Combine whole and fraction parts
  const priceWhole = $('.a-price-whole').first().text().replace(/[.,]$/, '').trim();
  const priceFraction = $('.a-price-fraction').first().text().trim();
  const priceSymbol = $('.a-price-symbol').first().text().trim();

  if (priceWhole) {
    const combined = priceFraction ? `${priceWhole}.${priceFraction}` : priceWhole;
    return parseAmazonPrice(priceSymbol + combined, url);
  }

  // Method 6: Legacy buybox price selectors
  const legacyPrice = $('#price_inside_buybox, #priceblock_ourprice, #priceblock_dealprice').first().text().trim();
  if (legacyPrice) {
    return parseAmazonPrice(legacyPrice, url);
  }

  // Method 7: Buy used/new offer-price (when main buybox shows used only)
  const offerPrice = $('.offer-price, .a-color-price.offer-price').first().text().trim();
  if (offerPrice) {
    return parseAmazonPrice(offerPrice, url);
  }

  // Method 8: usedOnlyBuybox price
  const usedBuyboxPrice = $('#usedOnlyBuybox .offer-price, #usedBuySection .offer-price').first().text().trim();
  if (usedBuyboxPrice) {
    return parseAmazonPrice(usedBuyboxPrice, url);
  }

  console.log('Amazon: No price found');
  return null;
}

function detectCurrency(url) {
  if (url.includes('amazon.com.tr')) return 'TRY';
  if (url.includes('amazon.co.uk')) return 'GBP';
  if (url.includes('amazon.de') || url.includes('amazon.fr') || url.includes('amazon.it') || url.includes('amazon.es')) return 'EUR';
  if (url.includes('amazon.co.jp')) return 'JPY';
  if (url.includes('amazon.ca')) return 'CAD';
  if (url.includes('amazon.com.au')) return 'AUD';
  return 'USD'; // Default for amazon.com
}

function parseAmazonPrice(priceText, url) {
  const raw = priceText;
  let currency = detectCurrency(url);

  // Detect currency from price text
  if (priceText.includes('$')) currency = detectCurrency(url); // Keep detected
  if (priceText.includes('TL') || priceText.includes('₺')) currency = 'TRY';
  if (priceText.includes('£')) currency = 'GBP';
  if (priceText.includes('€')) currency = 'EUR';
  if (priceText.includes('¥')) currency = 'JPY';

  // Remove currency symbols and text
  let cleaned = priceText.replace(/[$£€¥₺]|TL|TRY|USD|GBP|EUR|JPY|CAD|AUD/gi, '').trim();

  // Handle different number formats:
  // US/UK: 1,234.56 (comma = thousands, dot = decimal)
  // Turkey/EU: 1.234,56 (dot = thousands, comma = decimal)

  if (currency === 'TRY' || currency === 'EUR') {
    // European format: 19.723,13 -> 19723.13
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // US format: 1,234.56 -> 1234.56
    cleaned = cleaned.replace(/,/g, '');
  }

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