<?php

namespace Hdrm147\PriceChecker\Concerns;

use Hdrm147\PriceChecker\Models\CompetitorPriceHistory;
use Hdrm147\PriceChecker\Models\CompetitorPriceSource;
use Hdrm147\PriceChecker\Models\ProductPriceHistory;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Mix into the host's Product Eloquent model so price-checker relationships
 * and helpers live in one place. The host's Product still owns nothing
 * price-related directly — `use HasCompetitorPrices;` is the only line.
 */
trait HasCompetitorPrices
{
    public function competitorPriceSources(): HasMany
    {
        return $this->hasMany(CompetitorPriceSource::class);
    }

    public function activeCompetitorSources(): HasMany
    {
        return $this->competitorPriceSources()->active();
    }

    public function competitorPriceHistory(): HasMany
    {
        return $this->hasMany(CompetitorPriceHistory::class);
    }

    public function priceHistory(): HasMany
    {
        return $this->hasMany(ProductPriceHistory::class);
    }

    public function getLatestCompetitorPrices()
    {
        return $this->competitorPriceSources()
            ->active()
            ->with('latestPrice')
            ->orderBy('priority', 'desc')
            ->get()
            ->filter(fn ($source) => $source->latestPrice !== null);
    }

    public function getLowestCompetitorPrice(): ?int
    {
        return $this->competitorPriceHistory()
            ->where('fetch_status', 'success')
            ->where('fetched_at', '>=', now()->subDays(7))
            ->min('price');
    }

    /**
     * @return array{position: ?int, total: int, is_lowest: ?bool, lowest_competitor?: ?int, difference_from_lowest?: int}
     */
    public function getPricePosition(): array
    {
        $ourPrice = $this->discounted_price ?? $this->price;
        $competitorPrices = $this->getLatestCompetitorPrices()
            ->pluck('latestPrice.price')
            ->filter()
            ->sort()
            ->values();

        if ($competitorPrices->isEmpty()) {
            return ['position' => null, 'total' => 0, 'is_lowest' => null];
        }

        $allPrices = $competitorPrices->push($ourPrice)->sort()->values();
        $position = $allPrices->search($ourPrice) + 1;

        return [
            'position' => $position,
            'total' => $allPrices->count(),
            'is_lowest' => $position === 1,
            'lowest_competitor' => $competitorPrices->first(),
            'difference_from_lowest' => $ourPrice - $competitorPrices->first(),
        ];
    }
}
