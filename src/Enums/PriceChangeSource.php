<?php

namespace Hdrm147\PriceChecker\Enums;

enum PriceChangeSource: string
{
    case MANUAL = 'manual';
    case IMPORT = 'import';
    case API = 'api';
    case DEAL = 'deal';
    case BULK = 'bulk';

    public function label(): string
    {
        return match ($this) {
            self::MANUAL => __('Manual'),
            self::IMPORT => __('Import'),
            self::API => __('API'),
            self::DEAL => __('Deal'),
            self::BULK => __('Bulk Update'),
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::MANUAL => 'info',
            self::IMPORT => 'warning',
            self::API => 'success',
            self::DEAL => 'primary',
            self::BULK => 'secondary',
        };
    }
}
