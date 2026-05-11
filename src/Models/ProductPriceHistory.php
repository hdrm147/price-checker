<?php

namespace Hdrm147\PriceChecker\Models;

use App\Models\User;
use Hdrm147\PriceChecker\Database\Factories\ProductPriceHistoryFactory;
use Hdrm147\PriceChecker\Enums\PriceChangeSource;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Append-only audit of own-product price changes. Extends Model directly
 * (not a SoftDeletes-bearing base) — there is no deleted_at column.
 */
class ProductPriceHistory extends Model
{
    use HasFactory;

    protected $table = 'product_price_history';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'change_source' => PriceChangeSource::class,
            'changed_at' => 'datetime',
            'percentage_change' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(config('price-checker.product_model'));
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }

    public function isPriceIncrease(): bool
    {
        return $this->price_difference !== null && $this->price_difference > 0;
    }

    public function isPriceDecrease(): bool
    {
        return $this->price_difference !== null && $this->price_difference < 0;
    }

    public function getFormattedOldValueAttribute(): ?string
    {
        return $this->old_value ? number_format($this->old_value).' '.config('price-checker.target_currency', 'IQD') : null;
    }

    public function getFormattedNewValueAttribute(): ?string
    {
        return $this->new_value ? number_format($this->new_value).' '.config('price-checker.target_currency', 'IQD') : null;
    }

    public function getFormattedDifferenceAttribute(): ?string
    {
        if ($this->price_difference === null) {
            return null;
        }

        $prefix = $this->price_difference > 0 ? '+' : '';

        return $prefix.number_format($this->price_difference).' '.config('price-checker.target_currency', 'IQD');
    }

    public function getFormattedPercentageAttribute(): ?string
    {
        if ($this->percentage_change === null) {
            return null;
        }

        $prefix = $this->percentage_change > 0 ? '+' : '';

        return $prefix.number_format($this->percentage_change, 2).'%';
    }

    protected static function newFactory(): ProductPriceHistoryFactory
    {
        return ProductPriceHistoryFactory::new();
    }
}
