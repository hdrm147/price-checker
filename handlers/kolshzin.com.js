const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Method 1: JSON-LD schema (most reliable)
  const jsonLdScript = $('script[type="application/ld+json"]').filter((i, el) => {
    const text = $(el).html();
    return text && text.includes('"@type":"Product"');
  }).first().html();

  if (jsonLdScript) {
    try {
      const data = JSON.parse(jsonLdScript);
      const product = data['@graph']?.find(item => item['@type'] === 'Product') || data;
      if (product && product.offers) {
        const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        // Handle priceSpecification structure (WooCommerce) or direct price
        const priceSpec = offer.priceSpecification?.[0] || offer.priceSpecification || offer;
        const price = priceSpec.price || offer.price;
        const currency = priceSpec.priceCurrency || offer.priceCurrency || 'IQD';

        if (price) {
          console.log('Kolshzin JSON-LD price:', price, 'Currency:', currency);
          return {
            price: String(price).replace(/[,\.]/g, ''),
            currency: currency,
            raw: price,
          };
        }
      }
    } catch (e) {
      console.log('Kolshzin JSON-LD parse error:', e.message);
    }
  }

  // Method 2: Single product price (wd-single-price widget)
  const singlePrice = $('.wd-single-price .woocommerce-Price-amount.amount bdi').first().text().trim();
  if (singlePrice) {
    const cleaned = singlePrice.replace(/[^\d.,]/g, '').replace(/,/g, '');
    console.log('Kolshzin single price:', singlePrice, '-> cleaned:', cleaned);
    return {
      price: cleaned,
      currency: 'IQD',
      raw: singlePrice,
    };
  }

  // Method 3: Product page p.price element
  const pPrice = $('p.price .woocommerce-Price-amount.amount bdi').first().text().trim();
  if (pPrice) {
    const cleaned = pPrice.replace(/[^\d.,]/g, '').replace(/,/g, '');
    console.log('Kolshzin p.price:', pPrice, '-> cleaned:', cleaned);
    return {
      price: cleaned,
      currency: 'IQD',
      raw: pPrice,
    };
  }

  // Method 4: Generic WooCommerce price (skip cart which has 0)
  const priceElements = $('.woocommerce-Price-amount.amount bdi');
  for (let i = 0; i < priceElements.length; i++) {
    const rawText = $(priceElements[i]).text().trim();
    const cleaned = rawText.replace(/[^\d.,]/g, '').replace(/,/g, '');
    if (cleaned && cleaned !== '0') {
      console.log('Kolshzin WooCommerce price:', rawText, '-> cleaned:', cleaned);
      return {
        price: cleaned,
        currency: 'IQD',
        raw: rawText,
      };
    }
  }

  console.log('Kolshzin: No price found');
  return null;
}

module.exports = { extractPrice };