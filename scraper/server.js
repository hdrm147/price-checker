const express = require('express');
const config = require('./config');
const { fetchPage } = require('./browser/PageFetcher');
const { getPoolManager } = require('./browser/PoolManager');
const { getHandler, getProxyMode, getFetchMode } = require('./handlers');

const HTTP_FETCH_TIMEOUT_MS = 15000;
const HTTP_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
};

async function fetchPlainHtml(url) {
  const r = await fetch(url, {
    headers: HTTP_FETCH_HEADERS,
    signal: AbortSignal.timeout(HTTP_FETCH_TIMEOUT_MS),
    redirect: 'follow',
  });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} ${r.statusText}`);
  }
  return r.text();
}

const app = express();
app.use(express.json({ limit: '5mb' }));

/**
 * Resolve which proxy URL (or null for direct) a request should use, based on
 * the handler's declared proxy mode and the global proxy config.
 *
 * Returns either:
 *   { url: string|null }  — use this proxy (null = direct)
 *   { error: 'proxy_unavailable' } — handler requires proxy but it's unavailable
 */
function resolveProxy(handlerKey) {
  const mode = getProxyMode(handlerKey);

  if (mode === 'direct') {
    return { url: null };
  }

  // 'residential' or 'auto' both want the proxy when available.
  if (!config.proxy) {
    return mode === 'residential'
      ? { error: 'proxy_unavailable' }
      : { url: null };
  }

  return { url: config.proxy };
}

async function scrapeOne({ url, handler: handlerKey, metadata }) {
  if (!url || !handlerKey) {
    return {
      success: false,
      error_code: 'invalid_request',
      error: 'url and handler are required',
    };
  }

  const fetchMode = getFetchMode(handlerKey);
  const handler = getHandler(url, handlerKey);

  // HTTP-only fast path — no browser, no pool. For handlers that read from
  // structured endpoints (Shopify .json, vendor JSON APIs) the html arg is
  // typically discarded by the handler itself.
  if (fetchMode === 'http') {
    try {
      const html = await fetchPlainHtml(url);
      const result = await handler.extractPrice(html, url);

      if (result === null || result === undefined) {
        return {
          success: false,
          error_code: 'price_not_found',
          error: 'Handler returned no price',
          raw_data: { handler: handlerKey, url, fetch_mode: 'http', html_length: html.length },
        };
      }

      return {
        success: true,
        price: typeof result.price === 'string' ? parseFloat(result.price) : result.price,
        currency: result.currency,
        is_available: true,
        is_in_stock: true,
        title: result.title ?? null,
        raw_data: { handler: handlerKey, url, fetch_mode: 'http', raw: result.raw },
      };
    } catch (err) {
      const errorCode = err.message?.includes('timeout') || err.name === 'TimeoutError' ? 'timeout' : 'failed';
      return {
        success: false,
        error_code: errorCode,
        error: err.message,
        raw_data: { handler: handlerKey, url, fetch_mode: 'http' },
      };
    }
  }

  // Browser path — anti-bot, JS-rendered pages, anything else.
  const proxy = resolveProxy(handlerKey);
  if (proxy.error) {
    return {
      success: false,
      error_code: proxy.error,
      error: `Handler "${handlerKey}" requires the residential proxy but it is unavailable`,
      raw_data: { proxy_mode: getProxyMode(handlerKey), proxy_configured: !!config.proxy },
    };
  }

  const pool = await getPoolManager().getPool(proxy.url);
  const instance = await pool.acquire();

  try {
    const html = await fetchPage(instance, url);
    const result = await handler.extractPrice(html, url);

    if (result === null || result === undefined) {
      return {
        success: false,
        error_code: 'price_not_found',
        error: 'Handler returned no price',
        raw_data: { handler: handlerKey, url, html_length: html.length },
      };
    }

    return {
      success: true,
      price: typeof result.price === 'string' ? parseFloat(result.price) : result.price,
      currency: result.currency,
      is_available: true,
      is_in_stock: true,
      title: result.title ?? null,
      raw_data: { handler: handlerKey, url, raw: result.raw, proxy_mode: proxy.url ? 'proxied' : 'direct' },
    };
  } catch (err) {
    const errorCode = err.message?.includes('timeout') ? 'timeout' : 'failed';
    return {
      success: false,
      error_code: errorCode,
      error: err.message,
      raw_data: { handler: handlerKey, url, stack: err.stack },
    };
  } finally {
    pool.release(instance);
  }
}

app.get('/health', (req, res) => {
  const pools = getPoolManager().stats();
  res.json({
    status: 'ok',
    proxy_configured: !!config.proxy,
    proxy_url: config.proxy,
    pools,
  });
});

app.post('/scrape', async (req, res) => {
  try {
    const result = await scrapeOne(req.body || {});
    res.json(result);
  } catch (err) {
    console.error('[/scrape] uncaught:', err);
    res.status(500).json({
      success: false,
      error_code: 'failed',
      error: err.message,
    });
  }
});

app.post('/scrape/batch', async (req, res) => {
  const { sources } = req.body || {};
  if (!Array.isArray(sources)) {
    return res.status(400).json({
      error: 'sources must be an array of { id, url, handler, metadata }',
    });
  }

  // Process serially per request — concurrency is achieved via the pool's
  // internal slots, which already cap parallelism per proxy mode.
  const results = [];
  for (const source of sources) {
    const result = await scrapeOne(source);
    results.push({ id: source.id, ...result });
  }

  res.json({ results });
});

const port = config.api.port;
app.listen(port, () => {
  console.log(`[scraper] listening on :${port}`);
  console.log(`[scraper] global proxy: ${config.proxy ?? '(none — all handlers exit direct unless declared otherwise)'}`);
});

process.on('SIGINT', async () => {
  console.log('[scraper] shutting down…');
  await getPoolManager().closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[scraper] shutting down…');
  await getPoolManager().closeAll();
  process.exit(0);
});
