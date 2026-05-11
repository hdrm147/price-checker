# Handler interface

Each `<vendor>.js` file exports a single async function that takes the rendered
HTML and the URL and returns either a price object or `null`:

```js
async function extractPrice(html, url) {
  const $ = cheerio.load(html);
  // …extract price…
  return { price: '299.98', currency: 'USD', raw: '$299.98' };
  // or: return null;  // means "couldn't find a price"
}

module.exports = extractPrice;
```

Returning `null` is the signal for `price_not_found` upstream.

## Per-handler proxy routing

Routing decisions live in `handlers/index.js` in the `PROXY_ROUTING` map. A
handler doesn't declare its own proxy preference inline — keeping handlers
as pure extraction functions makes them easier to test and easier to swap.

Modes:

- `'direct'` — never route through the configured proxy. Use for vendors
  that block residential IP ranges (e.g., Newegg returns 403 for Iraqi
  residential exits) or vendors where proxy adds no value (Iraqi local
  shops scraped from an Iraqi-region VPS).

- `'residential'` — must route through the proxy. If the global proxy is
  unconfigured or its tunnel is down, the request returns
  `error_code: 'proxy_unavailable'` and Laravel defers the source rather
  than burning its failure budget. Use only for vendors empirically
  confirmed to require a residential exit.

- `'auto'` — use the proxy if configured, fall back to direct if not.
  Default for handlers without an explicit entry. Most vendors land here.

## Adding a new handler

1. Create `<vendor>.js` with the `extractPrice(html, url)` export.
2. Add it to the `handlers` map in `handlers/index.js` (both by simple key
   like `'foo'` and by domain key like `'foo.com'` so URL auto-detection
   works).
3. If the vendor needs anything other than `'auto'` routing, add an entry
   to `PROXY_ROUTING` in the same file.
4. Drop a `<vendor>.samples.json` next to the handler with 1–3 known-stable
   product URLs:

   ```json
   [
     {
       "url": "https://vendor.com/product/abc",
       "expect": { "price": { "type": "number", "gt": 0 }, "currency": "USD" }
     }
   ]
   ```

5. Run `npm run smoke -- --handler=<vendor>` to verify.

## Browser-side hooks

Cookie setup, region selection, captcha handling, and Cloudflare-wait logic
all live in `browser/PageFetcher.js` keyed off the URL hostname. Handlers
themselves operate on already-rendered HTML. Don't reach into the browser
from inside a handler.
