const shopify = require('./_shopify');

/**
 * tt-tab uses "." as a thousand separator in the displayed price, and that
 * convention bleeds into Shopify's variant.price string (e.g., "100.000"
 * means 100,000 IQD, not 100). The shared default parser would interpret
 * "100.000" as decimal and return 100, which is off by 1000x.
 */
const parsePrice = (raw) => String(raw).replace(/\./g, '');

module.exports = {
  extractPrice: (html, url) => shopify.extractPrice(html, url, { parsePrice }),
};
