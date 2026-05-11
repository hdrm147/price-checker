/**
 * Per-host async lock with minimum interval. Keeps the scraper from
 * blowing through vendor rate limits when N queue workers all funnel
 * requests through the same scraper process.
 *
 * Usage:
 *   await withHostThrottle(url, 1500, () => fetch(url));
 *
 * Implementation: a Promise chain per host. Each new call appends itself
 * to the chain, sleeps if needed to honor the min interval, then runs.
 * fn errors don't break the chain — subsequent callers still pace correctly.
 */

const hostState = new Map();

async function withHostThrottle(url, minIntervalMs, fn) {
  let host;
  try {
    host = new URL(url).host;
  } catch {
    return fn();
  }

  let entry = hostState.get(host);
  if (!entry) {
    entry = { lastAt: 0, chain: Promise.resolve() };
    hostState.set(host, entry);
  }

  const run = entry.chain.then(async () => {
    const elapsed = Date.now() - entry.lastAt;
    if (elapsed < minIntervalMs) {
      await new Promise((r) => setTimeout(r, minIntervalMs - elapsed));
    }
    entry.lastAt = Date.now();
    return fn();
  });

  entry.chain = run.catch(() => {});
  return run;
}

module.exports = { withHostThrottle };
