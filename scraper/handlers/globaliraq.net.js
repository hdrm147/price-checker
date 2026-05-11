const shopify = require('./_shopify');

/**
 * Source URLs use globaliraq.net but the live store + .json API lives at
 * globaliraq.iq (the .net redirects to .iq). Hit .iq directly to skip the
 * round-trip and avoid the redirect-detection guard in fetchPlainHtml.
 */
module.exports = {
  extractPrice: (html, url) => shopify.extractPrice(html, url, { apiHost: 'globaliraq.iq' }),
};
