/**
 * Shared Shopify storefront extractor — `<product-url>.json` returns the
 * full product object. ~25-50x faster than rendering the page and
 * scraping CSS classes, and immune to class drift.
 *
 * Options:
 *   apiHost    — override the URL's host when constructing the .json call
 *                (e.g., source URLs use foo.net but the API lives at foo.iq).
 *   parsePrice — function (variantPrice) => normalized integer string.
 *                Default: standard decimal (strip trailing .000 fractional).
 *                Stores that abuse "." as a thousand separator (looking at
 *                you, tt-tab) need a custom one.
 *   currency   — defaults 'IQD'. Shopify's variant.price is per-store, so
 *                hardcode at the handler level.
 *
 * NO fallback over the html arg: Shopify redirects deleted products to the
 * homepage with status 200, and falling back to cheerio would silently
 * inject the homepage's first product price into the deleted source's row.
 * If .json fails, return null and let the source's failure counter handle it.
 */

const defaultParsePrice = (raw) => String(raw).replace(/\.0+$/, '');

async function extractPrice(html, url, options = {}) {
  const { apiHost, parsePrice = defaultParsePrice, currency = 'IQD' } = options;

  let apiUrl;
  try {
    const u = new URL(url);
    if (apiHost) u.host = apiHost;
    apiUrl = u.origin + u.pathname.replace(/\/+$/, '') + '.json';
  } catch {
    return null;
  }

  let r;
  try {
    r = await fetch(apiUrl, { signal: AbortSignal.timeout(2000) });
  } catch (err) {
    console.log(`Shopify[${apiHost ?? 'self'}]: .json fetch failed (${err.message}) for ${apiUrl}`);
    return null;
  }

  if (!r.ok) {
    console.log(`Shopify[${apiHost ?? 'self'}]: .json returned ${r.status} for ${apiUrl} — product likely removed`);
    return null;
  }

  const data = await r.json().catch(() => null);
  const variant = data?.product?.variants?.[0];
  const raw = variant?.price;

  if (!raw) {
    console.log(`Shopify[${apiHost ?? 'self'}]: .json had no variant price for ${apiUrl}`);
    return null;
  }

  const price = parsePrice(raw);
  if (!price || price === '0') {
    return null;
  }

  return {
    price,
    currency,
    title: data?.product?.title ?? null,
    raw: `${raw} ${currency} (.json)`,
  };
}

module.exports = { extractPrice, defaultParsePrice };
