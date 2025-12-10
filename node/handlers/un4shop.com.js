const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // UN4Shop uses a gradient styled price display
  // Format: <span class="text-6xl font-black ...">10,000</span> <span>د,ع</span>
  const priceSelectors = [
    '.bg-gradient-to-br .text-6xl',
    '.text-6xl.font-black',
    '[class*="bg-gradient"] .text-6xl',
  ];

  for (const selector of priceSelectors) {
    const el = $(selector).first();
    if (el.length) {
      const rawText = el.text().trim();

      // Extract numeric price - format is "10,000" with comma as thousands separator
      const priceMatch = rawText.match(/([\d,]+)/);
      if (!priceMatch) continue;

      // Remove commas to get clean number: 10,000 -> 10000
      const cleaned = priceMatch[1].replace(/,/g, '');

      if (cleaned && !isNaN(parseFloat(cleaned))) {
        console.log(`UN4Shop price: ${rawText} -> cleaned: ${cleaned}`);
        return { price: cleaned, currency: 'IQD', raw: rawText };
      }
    }
  }

  return null;
}

module.exports = { extractPrice };
