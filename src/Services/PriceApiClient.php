<?php

namespace Hdrm147\PriceChecker\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\PendingRequest;

class PriceApiClient
{
    protected string $baseUrl;
    protected string $apiKey;
    protected int $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('price-checker.api.url'), '/');
        $this->apiKey = config('price-checker.api.key');
        $this->timeout = config('price-checker.api.timeout', 30);
    }

    /**
     * Create a configured HTTP client instance.
     */
    protected function request(): PendingRequest
    {
        return Http::baseUrl($this->baseUrl)
            ->timeout($this->timeout)
            ->withHeaders([
                'X-API-Key' => $this->apiKey,
                'Accept' => 'application/json',
            ]);
    }

    /**
     * Get all products with price sources.
     */
    public function getProducts(array $params = []): array
    {
        $response = $this->request()->get('/api/products', $params);

        if ($response->failed()) {
            return ['error' => 'Failed to fetch products', 'products' => []];
        }

        return $response->json();
    }

    /**
     * Get price comparison data grouped by product.
     */
    public function getComparison(array $params = []): array
    {
        $response = $this->request()->get('/api/comparison', $params);

        if ($response->failed()) {
            return ['error' => 'Failed to fetch comparison', 'data' => []];
        }

        return $response->json();
    }

    /**
     * Get all current prices.
     */
    public function getPrices(array $params = []): array
    {
        $response = $this->request()->get('/api/prices', $params);

        if ($response->failed()) {
            return ['error' => 'Failed to fetch prices', 'prices' => []];
        }

        return $response->json();
    }

    /**
     * Get price history for a specific product.
     */
    public function getHistory(int $productId, string $range = '7d'): array
    {
        $response = $this->request()->get("/api/history/product/{$productId}", [
            'range' => $range,
        ]);

        if ($response->failed()) {
            return ['error' => 'Failed to fetch history', 'history' => []];
        }

        return $response->json();
    }

    /**
     * Get recent price changes.
     */
    public function getChanges(?string $since = null): array
    {
        $response = $this->request()->get('/api/changes', [
            'since' => $since ?? now()->subDay()->toISOString(),
        ]);

        if ($response->failed()) {
            return ['error' => 'Failed to fetch changes', 'changes' => []];
        }

        return $response->json();
    }

    /**
     * Get jobs/queue status.
     */
    public function getJobs(array $params = []): array
    {
        $response = $this->request()->get('/api/jobs', $params);

        if ($response->failed()) {
            return ['error' => 'Failed to fetch jobs', 'jobs' => []];
        }

        return $response->json();
    }

    /**
     * Check if the price server is healthy.
     */
    public function health(): array
    {
        $response = $this->request()->get('/health');

        if ($response->failed()) {
            return ['status' => 'error', 'message' => 'Price server unreachable'];
        }

        return $response->json();
    }
}
