# Scraper service

Stateless Express service consumed by `Hdrm147\PriceChecker\Services\PriceScraperService`. Pure function: `URL + handler key → price`. No DB, no scheduler, no queue.

## Endpoints

```
POST /scrape
  body: { url, handler, metadata }
  resp: { success, price?, currency?, is_available?, is_in_stock?, title?,
          error?, error_code?, raw_data }

POST /scrape/batch
  body: { sources: [{ id, url, handler, metadata }] }
  resp: { results: [{ id, …same envelope }] }

GET  /health
  resp: { status: 'ok', proxy_configured, proxy_url, pools: [...] }
```

## Run

```bash
npm install
npm start          # node server.js
# or
npm run dev        # node --watch server.js
```

Default port: `3000`. Override with `SCRAPER_PORT=…`.

## Optional residential proxy

When `SCRAPER_PROXY=socks5://host:port` is set, handlers declaring
`proxy: 'auto'` or `'residential'` (in `handlers/index.js`'s `PROXY_ROUTING`)
route Chromium through it. Handlers declaring `proxy: 'direct'` always exit
via the host's normal network regardless.

The current shipped routing (from Step 0 of the package lift):

| Handler                  | Mode     | Why |
|--------------------------|----------|-----|
| `newegg`, `newegg.com`   | `direct` | Iraqi residential gets 403 |
| All Iraqi locals         | `direct` | Proxy adds no value |
| `amazon` *               | `auto`   | Works direct on cyber; proxy is opt-in |
| `generic`                | `auto`   | Default fallback |

If you need to add a residential exit (e.g., a US-based residential service),
set `SCRAPER_PROXY=socks5://your-residential-exit:1080` and flip the
relevant handler to `'residential'` in `PROXY_ROUTING`.

## Smoke testing

Each handler ships `<vendor>.samples.json` next to it. The `npm run smoke`
runner iterates all handlers with samples and reports per-handler success.

```bash
npm run smoke                              # all handlers
npm run smoke -- --handler=amazon          # one handler
npm run smoke -- --proxy=force-direct      # bypass global proxy
npm run smoke -- --proxy=force-residential # require global proxy
```

Sample shape:

```json
[
  {
    "url": "https://miswag.com/<some-product-url>",
    "expect": { "price": { "type": "number", "gt": 0 }, "currency": "IQD" }
  }
]
```

Pick stable, in-stock products and refresh occasionally — a discontinued or
sold-out listing breaks smoke for the wrong reason.

## Deployment

Co-located on cyber as a sibling Coolify container next to the Laravel app.
Internal Docker network only — never publicly exposed (no auth at the HTTP
layer; the network boundary is the trust boundary). Laravel reaches it as
`http://scraper:3000`.

When/if a separate VPS becomes desirable (RAM pressure from Chromium,
multi-brand consolidation, security isolation), point Laravel at the new
URL via `PRICE_SCRAPER_URL` and add a shared secret header. ~15 minutes
of work, no code change.

## Handler interface

See `handlers/_contract.md`.
