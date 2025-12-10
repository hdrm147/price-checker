const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // WajidIraq uses WooCommerce with WOOCS currency switcher
  // Price format: <span class="woocommerce-Price-amount amount"><bdi>120.000 ع.د</bdi></span>
  const priceSelectors = [
    '.product-page-price .woocommerce-Price-amount bdi',
    '.product-page-price .woocommerce-Price-amount',
    '.price .woocommerce-Price-amount bdi',
    '.price .woocommerce-Price-amount',
    '.woocs_price_code .woocommerce-Price-amount bdi',
  ];

  for (const selector of priceSelectors) {
    const el = $(selector).first();
    if (el.length) {
      const rawText = el.text().trim();

      // Extract numeric price - format is "120.000 ع.د" (Arabic thousands separator uses .)
      // The . here is thousands separator, not decimal
      const priceMatch = rawText.match(/([\d.]+)/);
      if (!priceMatch) continue;

      // Remove the thousands separator (.) to get clean number
      // 120.000 -> 120000
      const cleaned = priceMatch[1].replace(/\./g, '');

      if (cleaned && !isNaN(parseFloat(cleaned))) {
        console.log(`WajidIraq price: ${rawText} -> cleaned: ${cleaned}`);
        return { price: cleaned, currency: 'IQD', raw: rawText };
      }
    }
  }

  return null;
}

module.exports = { extractPrice };
