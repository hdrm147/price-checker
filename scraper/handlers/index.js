const genericHandler = require('./generic');
const globaliraqHandler = require('./globaliraq.net');
const amazonHandler = require('./amazon');
const kolshzinHandler = require('./kolshzin.com');
const neweggHandler = require('./newegg.com');
const alityanHandler = require('./alityan.com');
const anasHandler = require('./anas-iq.com');
const alfarahHandler = require('./alfarah-store.com');
const alfawazHandler = require('./alfawaz.com.iq');
const galaxyHandler = require('./galaxy-iq.com');
const threeDIraqHandler = require('./3d-iraq.com');
const mizzoHandler = require('./mizzostore.com');
const ttTabHandler = require('./tt-tab.net');
const miswagHandler = require('./miswag.com');
const wajidHandler = require('./wajidiraq.com');
const un4shopHandler = require('./un4shop.com');
const shopifyHandler = require('./_shopify');

const handlers = {
  generic: genericHandler,
  amazon: amazonHandler,
  newegg: neweggHandler,

  'globaliraq.net': globaliraqHandler,
  'amazon.com': amazonHandler,
  'amazon.com.tr': amazonHandler,
  'kolshzin.com': kolshzinHandler,
  'newegg.com': neweggHandler,
  'alityan.com': alityanHandler,
  'store.alnabaa.com': shopifyHandler,
  'menairq.com': shopifyHandler,
  'toolmart.me': shopifyHandler,
  'anas-iq.com': anasHandler,
  'alfarah-store.com': alfarahHandler,
  'alfawaz.com.iq': alfawazHandler,
  'galaxy-iq.com': galaxyHandler,
  '3d-iraq.com': threeDIraqHandler,
  'mizzostore.com': mizzoHandler,
  'tt-tab.net': ttTabHandler,
  'miswag.com': miswagHandler,
  'wajidiraq.com': wajidHandler,
  'un4shop.com': un4shopHandler,
};

/**
 * Per-handler proxy routing. Empirics from Step 0 of the package lift:
 *   - Iraqi residential exit gets 403'd by Newegg (and likely other
 *     US-focused vendors). Cyber's Linode datacenter IP works fine for
 *     both Amazon and Newegg with puppeteer-real-browser stealth.
 *   - All Iraqi local vendors are unaffected by IP origin in practice;
 *     proxy adds latency for no benefit.
 *   - Amazon is happy from either path; left on 'auto' so we can flip
 *     to a US residential later if a block ever emerges.
 *
 * Modes:
 *   'direct'      — never use proxy regardless of global config
 *   'residential' — must use proxy; if unavailable return proxy_unavailable
 *   'auto'        — use proxy if globally configured + healthy, else direct
 */
const PROXY_ROUTING = {
  amazon: 'auto',
  'amazon.com': 'auto',
  'amazon.com.tr': 'auto',

  newegg: 'direct',
  'newegg.com': 'direct',

  '3d-iraq.com': 'direct',
  'alfarah-store.com': 'direct',
  'alfawaz.com.iq': 'direct',
  'alityan.com': 'direct',
  'anas-iq.com': 'direct',
  'galaxy-iq.com': 'direct',
  'globaliraq.net': 'direct',
  'kolshzin.com': 'direct',
  'miswag.com': 'direct',
  'mizzostore.com': 'direct',
  'store.alnabaa.com': 'direct',
  'tt-tab.net': 'direct',
  'un4shop.com': 'direct',
  'wajidiraq.com': 'direct',

  generic: 'auto',
};

/**
 * Per-handler fetch mode. Handlers that hit a structured JSON endpoint
 * (Shopify .json, vendor APIs, etc.) skip the BrowserPool entirely — way
 * faster and more reliable than rendering a full page just to scrape a div.
 *
 *   'browser' — default. Render via puppeteer-real-browser pool.
 *   'http'    — server fetches HTML with plain fetch(). Handlers may
 *               ignore the html arg and call their own JSON endpoint.
 */
const FETCH_MODE = {
  miswag: 'http',
  'miswag.com': 'http',
  'store.alnabaa.com': 'http',
  'menairq.com': 'http',
  'toolmart.me': 'http',
  'tt-tab.net': 'http',
  'globaliraq.net': 'http',
};

/**
 * Resolve a request to its registry key by URL hostname first, falling back
 * to the caller's handlerName. The PHP side stores handler_key as 'generic'
 * for everything except amazon/newegg, so URL is the only reliable signal
 * for per-host routing.
 */
function lookup(map, url, handlerName) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (map[hostname] !== undefined) return map[hostname];
  } catch {
    // invalid URL, fall through
  }
  if (handlerName && map[handlerName] !== undefined) return map[handlerName];
  return undefined;
}

function getHandler(url, handlerName) {
  return lookup(handlers, url, handlerName) ?? handlers.generic;
}

function getProxyMode(url, handlerName) {
  return lookup(PROXY_ROUTING, url, handlerName) ?? 'auto';
}

function getFetchMode(url, handlerName) {
  return lookup(FETCH_MODE, url, handlerName) ?? 'browser';
}

module.exports = { getHandler, getProxyMode, getFetchMode, handlers };
