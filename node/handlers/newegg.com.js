const cheerio = require('cheerio');

async function extractPrice(html, url) {
  const $ = cheerio.load(html);

  // Method 1: Main product buy box price
  const buyBoxPrice = $('.product-buy-box .price-current');
  if (buyBoxPrice.length) {
    const dollars = buyBoxPrice.find('strong').first().text().trim().replace(/,/g, '');
    const cents = buyBoxPrice.find('sup').first().text().trim().replace('.', '');

    if (dollars) {
      const price = cents ? `${dollars}.${cents}` : dollars;
      console.log('Newegg buy box price:', price);
      return {
        price: price,
        currency: 'USD',
        raw: `$${dollars}${cents ? '.' + cents : ''}`,
      };
    }
  }

  // Method 2: Generic price-current selector
  const priceCurrentEl = $('.price-current').first();
  if (priceCurrentEl.length) {
    const dollars = priceCurrentEl.find('strong').first().text().trim().replace(/,/g, '');
    const cents = priceCurrentEl.find('sup').first().text().trim().replace('.', '');

    if (dollars) {
      const price = cents ? `${dollars}.${cents}` : dollars;
      console.log('Newegg price-current:', price);
      return {
        price: price,
        currency: 'USD',
        raw: `$${dollars}${cents ? '.' + cents : ''}`,
      };
    }
  }

  // Method 3: Price from text content
  const priceText = $('.price-current').first().text().trim();
  if (priceText) {
    const match = priceText.match(/\$?([\d,]+)\.?(\d{2})?/);
    if (match) {
      const price = match[2] ? `${match[1].replace(/,/g, '')}.${match[2]}` : match[1].replace(/,/g, '');
      console.log('Newegg text price:', price);
      return {
        price: price,
        currency: 'USD',
        raw: priceText,
      };
    }
  }

  console.log('Newegg: No price found');
  return null;
}

module.exports = { extractPrice };
