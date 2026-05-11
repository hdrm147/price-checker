<?php

use App\Models\Product;

return [
    /*
    |--------------------------------------------------------------------------
    | Product model
    |--------------------------------------------------------------------------
    |
    | The host application's Product Eloquent model. CompetitorPriceSource and
    | CompetitorPriceHistory both belongTo this class. Defaulting to
    | App\Models\Product keeps existing host code working without overrides.
    |
    */
    'product_model' => env('PRICE_CHECKER_PRODUCT_MODEL', Product::class),

    /*
    |--------------------------------------------------------------------------
    | Target currency
    |--------------------------------------------------------------------------
    |
    | Currency that competitor prices are normalized to before being stored in
    | competitor_price_history.price. Conversion happens via the host-bound
    | CurrencyConverter contract.
    |
    */
    'target_currency' => env('PRICE_CHECKER_TARGET_CURRENCY', 'IQD'),

    /*
    |--------------------------------------------------------------------------
    | Fetch schedule
    |--------------------------------------------------------------------------
    */
    'fetch' => [
        'cadence_cron' => env('PRICE_CHECKER_FETCH_CADENCE_CRON', '0 */6 * * *'),
        'hours_threshold' => (int) env('PRICE_CHECKER_HOURS_THRESHOLD', 6),
    ],

    /*
    |--------------------------------------------------------------------------
    | Scraper service
    |--------------------------------------------------------------------------
    |
    | Stateless Express service that takes { url, handler, metadata } and
    | returns the extracted price. The `proxy` key is optional — when set to
    | a SOCKS5 URL, handlers declaring `proxy: 'residential'` or `'auto'` use
    | it; handlers declaring `proxy: 'direct'` always exit via the scraper's
    | host network.
    |
    */
    'scraper' => [
        'url' => env('PRICE_SCRAPER_URL', 'http://localhost:3000'),
        'timeout' => (int) env('PRICE_SCRAPER_TIMEOUT', 60),
        'proxy' => env('PRICE_SCRAPER_PROXY'),
    ],
];
