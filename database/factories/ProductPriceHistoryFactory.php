<?php

namespace Hdrm147\PriceChecker\Database\Factories;

use App\Models\User;
use Hdrm147\PriceChecker\Enums\PriceChangeSource;
use Hdrm147\PriceChecker\Models\ProductPriceHistory;
use Illuminate\Database\Eloquent\Factories\Factory;

class ProductPriceHistoryFactory extends Factory
{
    protected $model = ProductPriceHistory::class;

    public function definition(): array
    {
        $oldValue = fake()->numberBetween(100000, 3000000);
        $newValue = fake()->numberBetween(100000, 3000000);
        $difference = $newValue - $oldValue;
        $percentageChange = $oldValue > 0 ? round(($difference / $oldValue) * 100, 2) : null;
        $productModel = config('price-checker.product_model');

        return [
            'product_id' => $productModel::factory(),
            'field_name' => fake()->randomElement(['price', 'discounted_price']),
            'old_value' => $oldValue,
            'new_value' => $newValue,
            'price_difference' => $difference,
            'percentage_change' => $percentageChange,
            'change_source' => PriceChangeSource::MANUAL,
            'changed_by' => null,
            'notes' => null,
            'changed_at' => now(),
        ];
    }

    public function forProduct($product): static
    {
        return $this->state(fn () => [
            'product_id' => $product->id,
        ]);
    }

    public function priceField(): static
    {
        return $this->state(fn () => ['field_name' => 'price']);
    }

    public function discountedPriceField(): static
    {
        return $this->state(fn () => ['field_name' => 'discounted_price']);
    }

    public function manual(?User $user = null): static
    {
        return $this->state(fn () => [
            'change_source' => PriceChangeSource::MANUAL,
            'changed_by' => $user?->id,
        ]);
    }

    public function import(): static
    {
        return $this->state(fn () => [
            'change_source' => PriceChangeSource::IMPORT,
        ]);
    }

    public function api(): static
    {
        return $this->state(fn () => [
            'change_source' => PriceChangeSource::API,
        ]);
    }

    public function priceIncrease(int $oldPrice, int $newPrice): static
    {
        $difference = $newPrice - $oldPrice;
        $percentageChange = $oldPrice > 0 ? round(($difference / $oldPrice) * 100, 2) : null;

        return $this->state(fn () => [
            'old_value' => $oldPrice,
            'new_value' => $newPrice,
            'price_difference' => $difference,
            'percentage_change' => $percentageChange,
        ]);
    }

    public function priceDecrease(int $oldPrice, int $newPrice): static
    {
        return $this->priceIncrease($oldPrice, $newPrice);
    }
}
