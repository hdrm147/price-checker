const genericHandler = require('./generic');
const globaliraqHandler = require('./globaliraq.net');
const amazonHandler = require('./amazon');
const kolshzinHandler = require('./kolshzin.com');
const neweggHandler = require('./newegg.com');
const alityanHandler = require('./alityan.com');
const alnabaaHandler = require('./store.alnabaa.com');
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
  'store.alnabaa.com': alnabaaHandler,
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

function getHandler(url, handlerName) {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    if (handlers[hostname]) {
      return handlers[hostname];
    }
  } catch {
    // invalid URL, fall through
  }

  if (handlerName && handlers[handlerName]) {
    return handlers[handlerName];
  }

  return handlers.generic;
}

function getProxyMode(handlerName) {
  return PROXY_ROUTING[handlerName] ?? 'auto';
}

module.exports = { getHandler, getProxyMode, handlers };
