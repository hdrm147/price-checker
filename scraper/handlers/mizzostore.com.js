const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Format: 34,000 IQD in .price-sale.js-price
  const priceEl = $('.price-sale.js-price, .js-price').first();

  if (priceEl.length) {
    const priceText = priceEl.text().trim();
    // Extract number, remove commas
    const cleaned = priceText.replace(/[^\d,]/g, '').replace(/,/g, '');

    if (cleaned) {
      console.log(`Mizzo price: ${priceText} -> cleaned: ${cleaned}`);
      return { price: cleaned, currency: 'IQD', raw: priceText };
    }
  }

  // Fallback: look for price pattern with IQD
  const bodyText = $('body').text();
  const match = bodyText.match(/(\d{1,3}(?:,\d{3})+)\s*IQD/i);
  if (match) {
    const cleaned = match[1].replace(/,/g, '');
    console.log(`Mizzo regex price: ${match[0]} -> cleaned: ${cleaned}`);
    return { price: cleaned, currency: 'IQD', raw: match[0] };
  }

  console.log('Mizzo: No price found');
  return null;
}

module.exports = { extractPrice };