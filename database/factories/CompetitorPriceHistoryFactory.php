<?php

namespace Hdrm147\PriceChecker\Database\Factories;

use Hdrm147\PriceChecker\Enums\FetchStatus;
use Hdrm147\PriceChecker\Models\CompetitorPriceHistory;
use Hdrm147\PriceChecker\Models\CompetitorPriceSource;
use Illuminate\Database\Eloquent\Factories\Factory;

class CompetitorPriceHistoryFactory extends Factory
{
    protected $model = CompetitorPriceHistory::class;

    public function definition(): array
    {
        $source = CompetitorPriceSource::factory()->create();

        return [
            'competitor_price_source_id' => $source->id,
            'product_id' => $source->product_id,
            'price' => fake()->numberBetween(100000, 5000000),
            'original_price' => fake()->numberBetween(10000, 500000),
            'original_currency' => 'USD',
            'exchange_rate' => 1310,
            'is_available' => true,
            'is_in_stock' => true,
            'fetch_status' => FetchStatus::SUCCESS,
            'error_message' => null,
            'raw_data' => [],
            'fetched_at' => now(),
        ];
    }

    public function forSource(CompetitorPriceSource $source): static
    {
        return $this->state(fn () => [
            'competitor_price_source_id' => $source->id,
            'product_id' => $source->product_id,
        ]);
    }

    public function success(): static
    {
        return $this->state(fn () => [
            'fetch_status' => FetchStatus::SUCCESS,
            'error_message' => null,
        ]);
    }

    public function failed(string $reason = 'Failed to fetch'): static
    {
        return $this->state(fn () => [
            'fetch_status' => FetchStatus::FAILED,
            'price' => null,
            'original_price' => null,
            'is_available' => false,
            'error_message' => $reason,
        ]);
    }

    public function unavailable(): static
    {
        return $this->state(fn () => [
            'fetch_status' => FetchStatus::UNAVAILABLE,
            'is_available' => false,
            'is_in_stock' => false,
        ]);
    }

    public function priceNotFound(): static
    {
        return $this->state(fn () => [
            'fetch_status' => FetchStatus::PRICE_NOT_FOUND,
            'price' => null,
            'original_price' => null,
        ]);
    }
}
