const cheerio = require('cheerio');

async function extractPrice(html, url) {
  // Shopify storefront JSON — ~25-50x faster than rendering the page,
  // and immune to CSS-class drift. Falls back to cheerio if the .json
  // endpoint ever stops returning a usable price.
  const apiUrl = url.split('?')[0].replace(/\/+$/, '') + '.json';
  try {
    const r = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
    if (r.ok) {
      const data = await r.json();
      const variant = data?.product?.variants?.[0];
      const raw = variant?.price;
      if (raw) {
        const price = String(raw).replace(/\.0+$/, '');
        return {
          price,
          currency: 'IQD',
          title: data?.product?.title ?? null,
          raw: `${raw} IQD (.json)`,
        };
      }
    }
    console.log(`Alnabaa: .json returned no price (status ${r.status}), falling back to HTML`);
  } catch (err) {
    console.log(`Alnabaa: .json fetch failed (${err.message}), falling back to HTML`);
  }

  const $ = cheerio.load(html);

  const regularPrice = $('.f-price-item.f-price-item--regular').first().text().trim();
  if (regularPrice) {
    return parseAlnabaaPrice(regularPrice);
  }

  const salePrice = $('.f-price-item.f-price-item--sale').first().text().trim();
  if (salePrice) {
    return parseAlnabaaPrice(salePrice);
  }

  const anyPrice = $('.f-price-item').first().text().trim();
  if (anyPrice) {
    return parseAlnabaaPrice(anyPrice);
  }

  console.log('Alnabaa: No price found');
  return null;
}

function parseAlnabaaPrice(priceText) {
  const raw = priceText;

  // Format: "129,000 IQD" where , is thousands separator
  let cleaned = priceText.replace(/IQD/gi, '').trim();
  cleaned = cleaned.replace(/,/g, '');

  console.log('Alnabaa price:', raw, '-> cleaned:', cleaned);

  return {
    price: cleaned,
    currency: 'IQD',
    raw: raw,
  };
}

module.exports = { extractPrice };