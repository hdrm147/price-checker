const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Format: 681.120 ع.د (uses . as thousands separator)
  const priceEl = $('#product_details_price_container .text-primary, #product_details_price_container .h3').first();

  if (priceEl.length) {
    const priceText = priceEl.text().trim();
    // Remove Arabic currency symbol and spaces, convert . to nothing (thousands separator)
    // 681.120 -> 681120
    const cleaned = priceText.replace(/[^\d.]/g, '').replace(/\./g, '');

    if (cleaned) {
      console.log(`3D-Iraq price: ${priceText} -> cleaned: ${cleaned}`);
      return { price: cleaned, currency: 'IQD', raw: priceText };
    }
  }

  // Fallback: look for any price pattern with ع.د
  const bodyText = $('body').text();
  const match = bodyText.match(/(\d{1,3}(?:\.\d{3})+)\s*ع\.د/);
  if (match) {
    const cleaned = match[1].replace(/\./g, '');
    console.log(`3D-Iraq regex price: ${match[0]} -> cleaned: ${cleaned}`);
    return { price: cleaned, currency: 'IQD', raw: match[0] };
  }

  console.log('3D-Iraq: No price found');
  return null;
}

module.exports = { extractPrice };