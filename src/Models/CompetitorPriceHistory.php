<?php

namespace Hdrm147\PriceChecker\Models;

use Hdrm147\PriceChecker\Database\Factories\CompetitorPriceHistoryFactory;
use Hdrm147\PriceChecker\Enums\FetchStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompetitorPriceHistory extends Model
{
    use HasFactory;

    protected $table = 'competitor_price_history';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'fetch_status' => FetchStatus::class,
            'is_available' => 'boolean',
            'is_in_stock' => 'boolean',
            'raw_data' => 'json',
            'fetched_at' => 'datetime',
            'exchange_rate' => 'decimal:4',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(CompetitorPriceSource::class, 'competitor_price_source_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(config('price-checker.product_model'));
    }

    public function isSuccessful(): bool
    {
        return $this->fetch_status === FetchStatus::SUCCESS;
    }

    public function getFormattedPriceAttribute(): ?string
    {
        return $this->price ? number_format($this->price).' '.config('price-checker.target_currency', 'IQD') : null;
    }

    public function getFormattedOriginalPriceAttribute(): ?string
    {
        if (! $this->original_price) {
            return null;
        }

        return number_format($this->original_price / 100, 2).' '.$this->original_currency;
    }

    protected static function newFactory(): CompetitorPriceHistoryFactory
    {
        return CompetitorPriceHistoryFactory::new();
    }
}
