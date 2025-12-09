<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Price Server API Configuration
    |--------------------------------------------------------------------------
    |
    | Configure the connection to the Price Server (Node.js API).
    | The Nova UI will call this API to fetch price data.
    |
    */
    'api' => [
        'url' => env('PRICE_SERVER_URL', 'http://localhost:3003'),
        'key' => env('PRICE_SERVER_KEY', ''),
        'timeout' => env('PRICE_SERVER_TIMEOUT', 30),
    ],
];
