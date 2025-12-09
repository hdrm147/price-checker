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

const handlers = {
  // Simple keys (used in handler_key column)
  'generic': genericHandler,
  'amazon': amazonHandler,
  'newegg': neweggHandler,

  // Domain-based keys (for URL auto-detection)
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
};

function getHandler(url, handlerName) {
    // First, try to match domain from URL (primary method)
    try {
        const hostname = new URL(url).hostname.replace('www.', '');
        if (handlers[hostname]) {
            return handlers[hostname];
        }
    } catch (e) {
        // Invalid URL, continue to fallback
    }

    // Fallback to handler_key if specified
    if (handlerName && handlers[handlerName]) {
        return handlers[handlerName];
    }

    return handlers['generic'];
}

module.exports = {getHandler, handlers};