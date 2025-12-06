const genericHandler = require('./generic');
const globaliraqHandler = require('./globaliraq.net');
const amazonHandler = require('./amazon');
const kolshzinHandler = require('./kolshzin.com');
const neweggHandler = require('./newegg.com');
const alityanHandler = require('./alityan.com');
const alnabaaHandler = require('./store.alnabaa.com');
const anasHandler = require('./anas-iq.com');

const handlers = {
  'globaliraq.net': globaliraqHandler,
  'amazon.com': amazonHandler,
  'amazon.com.tr': amazonHandler,
  'kolshzin.com': kolshzinHandler,
  'newegg.com': neweggHandler,
  'alityan.com': alityanHandler,
  'store.alnabaa.com': alnabaaHandler,
  'anas-iq.com': anasHandler,
  'generic': genericHandler,
};

function getHandler(url, handlerName) {
    // If specific handler requested, use it
    if (handlerName && handlerName !== 'generic' && handlers[handlerName]) {
        return handlers[handlerName];
    }

    // Try to match domain from URL
    try {
        const hostname = new URL(url).hostname.replace('www.', '');
        if (handlers[hostname]) {
            return handlers[hostname];
        }
    } catch (e) {
        // Invalid URL, fall through to generic
    }

    return handlers['generic'];
}

module.exports = {getHandler, handlers};