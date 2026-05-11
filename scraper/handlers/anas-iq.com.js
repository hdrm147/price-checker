/**
 * Anas-IQ is a Next.js SPA — the rendered DOM exposes .out-price etc. only
 * AFTER client-side hydration. The static HTML body is empty, but Next.js
 * embeds initial state as JSON in <script id="__NEXT_DATA__">. Pulling
 * directly from there is way faster than rendering a browser AND immune
 * to CSS class drift.
 *
 * Path: data.props.maherData.data.{price, price_in_iqd, name}
 */

const NEXT_DATA_RE = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]+?)<\/script>/;

async function extractPrice(html, url) {
  const m = html.match(NEXT_DATA_RE);
  if (!m) {
    console.log(`Anas-IQ: no __NEXT_DATA__ block for ${url}`);
    return null;
  }

  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    console.log(`Anas-IQ: __NEXT_DATA__ JSON parse failed for ${url}`);
    return null;
  }

  const product = data?.props?.maherData?.data;
  const price = product?.price_in_iqd ?? product?.price;

  if (!price || price === 0) {
    return null;
  }

  return {
    price: String(price),
    currency: 'IQD',
    title: product?.name ?? null,
    raw: `${price} IQD (__NEXT_DATA__)`,
  };
}

module.exports = { extractPrice };
