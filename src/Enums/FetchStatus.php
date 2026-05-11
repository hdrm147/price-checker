<?php

namespace Hdrm147\PriceChecker\Enums;

enum FetchStatus: string
{
    case SUCCESS = 'success';
    case FAILED = 'failed';
    case UNAVAILABLE = 'unavailable';
    case PRICE_NOT_FOUND = 'price_not_found';
    case RATE_LIMITED = 'rate_limited';
    case TIMEOUT = 'timeout';
    case PROXY_UNAVAILABLE = 'proxy_unavailable';

    public function label(): string
    {
        return match ($this) {
            self::SUCCESS => __('Success'),
            self::FAILED => __('Failed'),
            self::UNAVAILABLE => __('Unavailable'),
            self::PRICE_NOT_FOUND => __('Price Not Found'),
            self::RATE_LIMITED => __('Rate Limited'),
            self::TIMEOUT => __('Timeout'),
            self::PROXY_UNAVAILABLE => __('Proxy Unavailable'),
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::SUCCESS => 'success',
            self::FAILED => 'danger',
            self::UNAVAILABLE => 'warning',
            self::PRICE_NOT_FOUND => 'info',
            self::RATE_LIMITED => 'warning',
            self::TIMEOUT => 'danger',
            self::PROXY_UNAVAILABLE => 'warning',
        };
    }

    /**
     * Whether this status should defer the source rather than count as a failure.
     * Transient conditions (rate limits, proxy down, network timeouts) shouldn't
     * burn the failure budget that auto-deactivates sources after 5 strikes.
     */
    public function isDeferral(): bool
    {
        return match ($this) {
            self::PROXY_UNAVAILABLE,
            self::RATE_LIMITED,
            self::TIMEOUT => true,
            default => false,
        };
    }
}
