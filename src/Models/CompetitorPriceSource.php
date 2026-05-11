<?php

namespace Hdrm147\PriceChecker\Models;

use Hdrm147\PriceChecker\Database\Factories\CompetitorPriceSourceFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class CompetitorPriceSource extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'show_in_app' => 'boolean',
            'is_international' => 'boolean',
            'metadata' => 'json',
            'last_fetched_at' => 'datetime',
            'last_successful_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $source) {
            if (empty($source->domain)) {
                $source->domain = parse_url($source->url, PHP_URL_HOST) ?? '';
            }

            if (empty($source->handler_key)) {
                $source->handler_key = self::detectHandlerKey($source->url);
            }
        });
    }

    public static function detectHandlerKey(string $url): string
    {
        $host = parse_url($url, PHP_URL_HOST) ?? '';

        $handlers = [
            'amazon' => ['amazon.com', 'amazon.ae', 'amazon.co.uk', 'amazon.de'],
            'newegg' => ['newegg.com', 'newegg.ca'],
        ];

        foreach ($handlers as $key => $domains) {
            foreach ($domains as $domain) {
                if (str_contains($host, $domain)) {
                    return $key;
                }
            }
        }

        return 'generic';
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(config('price-checker.product_model'));
    }

    public function priceHistory(): HasMany
    {
        return $this->hasMany(CompetitorPriceHistory::class);
    }

    public function latestPrice(): HasOne
    {
        return $this->hasOne(CompetitorPriceHistory::class)
            ->where('fetch_status', 'success')
            ->latest('fetched_at');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeForApp(Builder $query): Builder
    {
        return $query->where('show_in_app', true);
    }

    public function scopeInternational(Builder $query): Builder
    {
        return $query->where('is_international', true);
    }

    public function scopeLocal(Builder $query): Builder
    {
        return $query->where('is_international', false);
    }

    public function scopeDueFetch(Builder $query, int $hoursThreshold = 6): Builder
    {
        return $query->where(function ($q) use ($hoursThreshold) {
            $q->whereNull('last_fetched_at')
                ->orWhere('last_fetched_at', '<', now()->subHours($hoursThreshold));
        });
    }

    public function markFailed(): void
    {
        $this->increment('consecutive_failures');
        $this->update(['last_fetched_at' => now()]);

        if ($this->consecutive_failures >= 5) {
            $this->update(['is_active' => false]);
        }
    }

    public function markSuccess(): void
    {
        $this->update([
            'consecutive_failures' => 0,
            'last_fetched_at' => now(),
            'last_successful_at' => now(),
        ]);
    }

    protected static function newFactory(): CompetitorPriceSourceFactory
    {
        return CompetitorPriceSourceFactory::new();
    }
}
