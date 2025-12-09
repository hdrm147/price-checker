const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Method 1: Extract from meta tags (most reliable)
  const metaPrice = $('meta[property="product:price:amount"]').attr('content');
  const metaCurrency = $('meta[property="product:price:currency"]').attr('content');

  console.log('Meta price found:', metaPrice, 'Currency:', metaCurrency);

  if (metaPrice) {
    return {
      price: metaPrice.replace(/,/g, ''),
      currency: metaCurrency || 'IQD',
      raw: metaPrice,
    };
  }

  // Method 2: Extract from JSON-LD schema
  const jsonLdScript = $('script[type="application/ld+json"]').filter((i, el) => {
    const text = $(el).html();
    return text && text.includes('"@type":"Product"');
  }).first().html();

  if (jsonLdScript) {
    try {
      const data = JSON.parse(jsonLdScript);
      if (data.offers) {
        const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
        return {
          price: String(offer.price).replace(/\.0+$/, ''),
          currency: offer.priceCurrency || 'IQD',
          raw: offer.price,
        };
      }
    } catch (e) {}
  }

  // Method 3: Fallback to sale-price element
  const salePrice = $('sale-price').first().text().trim();
  if (salePrice) {
    const cleaned = salePrice.replace(/[^\d.,]/g, '').replace(/,/g, '');
    return {
      price: cleaned,
      currency: 'IQD',
      raw: salePrice,
    };
  }

  return null;
}

module.exports = { extractPrice };