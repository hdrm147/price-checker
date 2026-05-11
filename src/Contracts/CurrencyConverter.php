<?php

namespace Hdrm147\PriceChecker\Contracts;

/**
 * Host-supplied currency converter. The package never references a specific
 * currency conversion implementation; the host binds this interface to its
 * own service in AppServiceProvider.
 */
interface CurrencyConverter
{
    /**
     * Convert an amount from one currency to another.
     *
     * @return array{amount: float, rate: float}
     */
    public function convert(float $amount, string $from, string $to): array;
}
