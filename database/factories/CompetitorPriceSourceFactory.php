<?php

namespace Hdrm147\PriceChecker\Database\Factories;

use Hdrm147\PriceChecker\Models\CompetitorPriceSource;
use Illuminate\Database\Eloquent\Factories\Factory;

class CompetitorPriceSourceFactory extends Factory
{
    protected $model = CompetitorPriceSource::class;

    public function definition(): array
    {
        $stores = [
            ['domain' => 'amazon.com', 'store_name' => 'Amazon US', 'handler_key' => 'amazon', 'is_international' => true],
            ['domain' => 'newegg.com', 'store_name' => 'Newegg', 'handler_key' => 'newegg', 'is_international' => true],
            ['domain' => 'localstore.iq', 'store_name' => 'Local Store', 'handler_key' => 'generic', 'is_international' => false],
        ];

        $store = fake()->randomElement($stores);
        $productModel = config('price-checker.product_model');

        return [
            'product_id' => $productModel::factory(),
            'url' => "https://{$store['domain']}/product/".fake()->uuid(),
            'domain' => $store['domain'],
            'store_name' => $store['store_name'],
            'handler_key' => $store['handler_key'],
            'is_active' => true,
            'show_in_app' => fake()->boolean(70),
            'is_international' => $store['is_international'],
            'priority' => fake()->numberBetween(0, 10),
            'consecutive_failures' => 0,
        ];
    }

    public function amazon(): static
    {
        return $this->state(fn () => [
            'url' => 'https://amazon.com/product/'.fake()->uuid(),
            'domain' => 'amazon.com',
            'store_name' => 'Amazon US',
            'handler_key' => 'amazon',
            'is_international' => true,
        ]);
    }

    public function newegg(): static
    {
        return $this->state(fn () => [
            'url' => 'https://newegg.com/product/'.fake()->uuid(),
            'domain' => 'newegg.com',
            'store_name' => 'Newegg',
            'handler_key' => 'newegg',
            'is_international' => true,
        ]);
    }

    public function local(): static
    {
        return $this->state(fn () => [
            'url' => 'https://localstore.iq/product/'.fake()->uuid(),
            'domain' => 'localstore.iq',
            'store_name' => 'Local Store',
            'handler_key' => 'generic',
            'is_international' => false,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    public function showInApp(): static
    {
        return $this->state(fn () => ['show_in_app' => true]);
    }

    public function hideFromApp(): static
    {
        return $this->state(fn () => ['show_in_app' => false]);
    }
}
