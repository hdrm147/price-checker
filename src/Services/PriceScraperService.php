<?php

namespace Hdrm147\PriceChecker\Services;

use Hdrm147\PriceChecker\Enums\FetchStatus;
use Hdrm147\PriceChecker\Models\CompetitorPriceSource;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PriceScraperService
{
    protected string $baseUrl;

    protected int $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim(config('price-checker.scraper.url', 'http://localhost:3000'), '/');
        $this->timeout = (int) config('price-checker.scraper.timeout', 60);
    }

    /**
     * Fetch price from the stateless scraper API.
     *
     * @return array{
     *     success: bool,
     *     status: FetchStatus,
     *     price: ?int,
     *     original_price: ?int,
     *     currency: string,
     *     is_available: bool,
     *     is_in_stock: ?bool,
     *     title: ?string,
     *     error: ?string,
     *     raw_data: array
     * }
     */
    public function fetchPrice(CompetitorPriceSource $source): array
    {
        if (! $source->is_active) {
            throw new \InvalidArgumentException(
                "Cannot fetch price from inactive source #{$source->id}. Filter by is_active before calling."
            );
        }

        try {
            $response = Http::timeout($this->timeout)
                ->post("{$this->baseUrl}/scrape", [
                    'url' => $source->url,
                    'handler' => $source->handler_key,
                    'metadata' => $source->metadata ?? [],
                ]);

            if ($response->failed()) {
                Log::warning('Price scraper API error', [
                    'source_id' => $source->id,
                    'url' => $source->url,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return $this->failedResponse(
                    FetchStatus::FAILED,
                    "API returned status {$response->status()}"
                );
            }

            return $this->normalizeResult($response->json() ?? []);

        } catch (ConnectionException $e) {
            Log::error('Price scraper connection failed', [
                'source_id' => $source->id,
                'url' => $source->url,
                'error' => $e->getMessage(),
            ]);

            return $this->failedResponse(FetchStatus::TIMEOUT, 'Connection to scraper failed');

        } catch (\Throwable $e) {
            Log::error('Price scraper exception', [
                'source_id' => $source->id,
                'url' => $source->url,
                'error' => $e->getMessage(),
            ]);

            return $this->failedResponse(FetchStatus::FAILED, $e->getMessage());
        }
    }

    /**
     * Batch fetch multiple sources. Indexed by source ID.
     *
     * @param  array<CompetitorPriceSource>  $sources
     * @return array<int, array>
     */
    public function fetchBatch(array $sources): array
    {
        $inactive = collect($sources)->reject(fn ($source) => $source->is_active);
        if ($inactive->isNotEmpty()) {
            $ids = $inactive->pluck('id')->implode(', ');
            throw new \InvalidArgumentException(
                "Cannot fetch prices from inactive sources: #{$ids}. Filter by is_active before calling."
            );
        }

        $payload = collect($sources)->map(fn ($source) => [
            'id' => $source->id,
            'url' => $source->url,
            'handler' => $source->handler_key,
            'metadata' => $source->metadata ?? [],
        ])->values()->all();

        try {
            $response = Http::timeout($this->timeout * 2)
                ->post("{$this->baseUrl}/scrape/batch", [
                    'sources' => $payload,
                ]);

            if ($response->failed()) {
                return collect($sources)->mapWithKeys(fn ($source) => [
                    $source->id => $this->failedResponse(FetchStatus::FAILED, 'Batch API failed'),
                ])->all();
            }

            $results = $response->json('results', []);

            return collect($sources)->mapWithKeys(function ($source) use ($results) {
                $result = collect($results)->firstWhere('id', $source->id);

                if (! $result) {
                    return [$source->id => $this->failedResponse(FetchStatus::FAILED, 'No result in batch')];
                }

                return [$source->id => $this->normalizeResult($result)];
            })->all();

        } catch (\Throwable $e) {
            Log::error('Batch price scraper failed', ['error' => $e->getMessage()]);

            return collect($sources)->mapWithKeys(fn ($source) => [
                $source->id => $this->failedResponse(FetchStatus::FAILED, $e->getMessage()),
            ])->all();
        }
    }

    public function isAvailable(): bool
    {
        try {
            $response = Http::timeout(5)->get("{$this->baseUrl}/health");

            return $response->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Normalize a single scraper result into the canonical envelope.
     */
    protected function normalizeResult(array $data): array
    {
        if (! ($data['success'] ?? false)) {
            $status = match ($data['error_code'] ?? 'failed') {
                'unavailable' => FetchStatus::UNAVAILABLE,
                'price_not_found' => FetchStatus::PRICE_NOT_FOUND,
                'rate_limited' => FetchStatus::RATE_LIMITED,
                'timeout' => FetchStatus::TIMEOUT,
                'proxy_unavailable' => FetchStatus::PROXY_UNAVAILABLE,
                default => FetchStatus::FAILED,
            };

            return $this->failedResponse($status, $data['error'] ?? 'Unknown error', $data);
        }

        return [
            'success' => true,
            'status' => FetchStatus::SUCCESS,
            'price' => $data['price'] ?? null,
            'original_price' => $data['original_price'] ?? null,
            'currency' => $data['currency'] ?? 'USD',
            'is_available' => $data['is_available'] ?? true,
            'is_in_stock' => $data['is_in_stock'] ?? null,
            'title' => $data['title'] ?? null,
            'error' => null,
            'raw_data' => $data['raw_data'] ?? $data,
        ];
    }

    protected function failedResponse(FetchStatus $status, string $error, array $rawData = []): array
    {
        return [
            'success' => false,
            'status' => $status,
            'price' => null,
            'original_price' => null,
            'currency' => 'USD',
            'is_available' => false,
            'is_in_stock' => null,
            'title' => null,
            'error' => $error,
            'raw_data' => $rawData,
        ];
    }
}
