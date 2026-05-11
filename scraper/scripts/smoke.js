#!/usr/bin/env node
/**
 * Smoke test runner. Discovers <handler>.samples.json files alongside each
 * handler and runs them through the same /scrape pipeline. Used to verify
 * all 18 vendor handlers still extract prices correctly.
 *
 * Usage:
 *   npm run smoke
 *   npm run smoke -- --handler=amazon
 *   npm run smoke -- --proxy=force-direct        # ignore global proxy
 *   npm run smoke -- --proxy=force-residential   # ignore handler routing
 */
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { fetchPage } = require('../browser/PageFetcher');
const { getPoolManager } = require('../browser/PoolManager');
const { getHandler, getProxyMode, handlers } = require('../handlers');

function parseArgs(argv) {
  const out = { handler: null, proxy: 'auto' };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--handler=')) out.handler = arg.split('=')[1];
    else if (arg.startsWith('--proxy=')) out.proxy = arg.split('=')[1];
  }
  return out;
}

function loadSamples(handlerKey) {
  const file = path.join(__dirname, '..', 'handlers', `${handlerKey}.samples.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`[smoke] failed to parse ${file}: ${e.message}`);
    return null;
  }
}

function resolveProxyForSmoke(handlerKey, override) {
  if (override === 'force-direct') return { url: null };
  if (override === 'force-residential') {
    if (!config.proxy) return { error: 'proxy_unavailable' };
    return { url: config.proxy };
  }

  const mode = getProxyMode(handlerKey);
  if (mode === 'direct') return { url: null };
  if (!config.proxy) return mode === 'residential' ? { error: 'proxy_unavailable' } : { url: null };
  return { url: config.proxy };
}

function validate(result, expect) {
  if (!expect) return { ok: true };
  if (!result || result.success === false) {
    return { ok: false, reason: result?.error || 'no result' };
  }
  if (expect.price?.type === 'number') {
    const n = parseFloat(result.price);
    if (Number.isNaN(n)) return { ok: false, reason: `price not numeric: ${result.price}` };
    if (expect.price.gt !== undefined && !(n > expect.price.gt)) {
      return { ok: false, reason: `price ${n} not > ${expect.price.gt}` };
    }
  }
  if (expect.currency && result.currency !== expect.currency) {
    return { ok: false, reason: `currency ${result.currency} != ${expect.currency}` };
  }
  return { ok: true };
}

async function runSample(handlerKey, sample, proxyOverride) {
  const proxy = resolveProxyForSmoke(handlerKey, proxyOverride);
  const startedAt = Date.now();

  if (proxy.error) {
    return { ok: false, ms: 0, price: null, reason: proxy.error };
  }

  const pool = await getPoolManager().getPool(proxy.url);
  const instance = await pool.acquire();

  try {
    const html = await fetchPage(instance, sample.url);
    const handler = getHandler(sample.url, handlerKey);
    const result = await handler.extractPrice(html, sample.url);

    const v = validate(
      result ? { success: true, price: result.price, currency: result.currency } : { success: false },
      sample.expect
    );

    return {
      ok: v.ok,
      ms: Date.now() - startedAt,
      price: result?.price,
      currency: result?.currency,
      reason: v.ok ? null : v.reason,
    };
  } catch (err) {
    return { ok: false, ms: Date.now() - startedAt, reason: err.message };
  } finally {
    pool.release(instance);
  }
}

(async () => {
  const args = parseArgs(process.argv);
  const allKeys = Object.keys(handlers);
  const targets = args.handler ? [args.handler] : allKeys;

  let total = 0;
  let passed = 0;
  let skipped = 0;

  for (const key of targets) {
    const samples = loadSamples(key);
    if (!samples) {
      console.log(`[~] ${key.padEnd(22)} no samples — skipped`);
      skipped++;
      continue;
    }

    for (const sample of samples) {
      total++;
      const r = await runSample(key, sample, args.proxy);
      const mark = r.ok ? '✓' : '✗';
      const summary = r.ok
        ? `${r.price ?? '?'} ${r.currency ?? ''}`
        : r.reason;
      console.log(`[${mark}] ${key.padEnd(22)} ${String(r.ms).padStart(6)}ms  ${summary}`);
      if (r.ok) passed++;
    }
  }

  console.log('');
  console.log(`${passed}/${total} passing  (${skipped} handler(s) without samples)`);
  await getPoolManager().closeAll();
  process.exit(passed === total ? 0 : 1);
})();
