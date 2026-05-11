/**
 * Shopify storefront `.json` is authoritative for alnabaa.com. If it 404s
 * or returns no variant price, the product is genuinely gone — return null.
 *
 * NO cheerio fallback over `html`: alnabaa redirects deleted products to
 * the homepage with 200 status, and the homepage contains unrelated
 * products' prices. Falling back would silently inject wrong data.
 */
async function extractPrice(html, url) {
  const apiUrl = url.split('?')[0].replace(/\/+$/, '') + '.json';

  let r;
  try {
    r = await fetch(apiUrl, { signal: AbortSignal.timeout(10000) });
  } catch (err) {
    console.log(`Alnabaa: .json fetch failed (${err.message})`);
    return null;
  }

  if (!r.ok) {
    console.log(`Alnabaa: .json returned ${r.status} for ${apiUrl} — product likely removed`);
    return null;
  }

  const data = await r.json().catch(() => null);
  const variant = data?.product?.variants?.[0];
  const raw = variant?.price;

  if (!raw) {
    console.log(`Alnabaa: .json had no variant price for ${apiUrl}`);
    return null;
  }

  const price = String(raw).replace(/\.0+$/, '');
  return {
    price,
    currency: 'IQD',
    title: data?.product?.title ?? null,
    raw: `${raw} IQD (.json)`,
  };
}

module.exports = { extractPrice };