<?php

namespace Hdrm147\PriceChecker\Jobs;

use Hdrm147\PriceChecker\Contracts\CurrencyConverter;
use Hdrm147\PriceChecker\Enums\FetchStatus;
use Hdrm147\PriceChecker\Models\CompetitorPriceHistory;
use Hdrm147\PriceChecker\Models\CompetitorPriceSource;
use Hdrm147\PriceChecker\Services\PriceScraperService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class FetchCompetitorPricesJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public int $timeout = 600;

    public function __construct(
        protected ?int $priceSourceId = null,
        protected ?string $handlerKey = null,
        protected bool $forceAll = false,
        protected int $hoursThreshold = 6
    ) {}

    public function handle(PriceScraperService $scraper, CurrencyConverter $currency): void
    {
        if (! $scraper->isAvailable()) {
            Log::warning('Price scraper service is not available, skipping job');

            return;
        }

        $query = CompetitorPriceSource::query()
            ->active()
            ->with('product');

        if ($this->priceSourceId) {
            $query->where('id', $this->priceSourceId);
        }

        if ($this->handlerKey) {
            $query->where('handler_key', $this->handlerKey);
        }

        if (! $this->forceAll) {
            $query->dueFetch($this->hoursThreshold);
        }

        $sources = $query->get();

        if ($sources->isEmpty()) {
            Log::info('No competitor price sources to fetch');

            return;
        }

        Log::info('Starting competitor price fetch', [
            'total_sources' => $sources->count(),
            'price_source_id' => $this->priceSourceId,
            'handler_key' => $this->handlerKey,
        ]);

        $processed = 0;
        $successful = 0;

        foreach ($sources->groupBy('handler_key') as $handlerSources) {
            foreach ($handlerSources as $source) {
                $result = $this->processSource($source, $scraper, $currency);

                $processed++;
                if ($result['success']) {
                    $successful++;
                }

                usleep(500000); // 0.5s respectful delay
            }
        }

        Log::info('Completed competitor price fetch', [
            'processed' => $processed,
            'successful' => $successful,
        ]);
    }

    protected function processSource(
        CompetitorPriceSource $source,
        PriceScraperService $scraper,
        CurrencyConverter $currency
    ): array {
        try {
            $result = $scraper->fetchPrice($source);

            $targetCurrency = config('price-checker.target_currency', 'IQD');
            $priceInTarget = null;
            $exchangeRate = null;
            $originalPriceInCents = null;

            if ($result['price'] !== null) {
                $priceInSourceCurrency = is_string($result['price'])
                    ? (float) $result['price']
                    : $result['price'];

                $originalPriceInCents = (int) round($priceInSourceCurrency * 100);

                if ($result['currency'] !== $targetCurrency) {
                    $conversion = $currency->convert($priceInSourceCurrency, $result['currency'], $targetCurrency);
                    $priceInTarget = (int) round($conversion['amount']);
                    $exchangeRate = $conversion['rate'];
                } else {
                    $priceInTarget = (int) $priceInSourceCurrency;
                }
            }

            CompetitorPriceHistory::create([
                'competitor_price_source_id' => $source->id,
                'product_id' => $source->product_id,
                'price' => $priceInTarget,
                'original_price' => $originalPriceInCents,
                'original_currency' => $result['currency'],
                'exchange_rate' => $exchangeRate,
                'is_available' => $result['is_available'],
                'is_in_stock' => $result['is_in_stock'],
                'fetch_status' => $result['status'],
                'error_message' => $result['error'],
                'raw_data' => $result['raw_data'],
                'fetched_at' => now(),
            ]);

            // PROXY_UNAVAILABLE is a deferral, not a failure — don't burn the source's failure budget.
            if ($result['status'] === FetchStatus::SUCCESS) {
                $source->markSuccess();
            } elseif (! $result['status']->isDeferral()) {
                $source->markFailed();
            }

            return $result;

        } catch (\Throwable $e) {
            Log::error('Failed to process price source', [
                'source_id' => $source->id,
                'url' => $source->url,
                'error' => $e->getMessage(),
            ]);

            CompetitorPriceHistory::create([
                'competitor_price_source_id' => $source->id,
                'product_id' => $source->product_id,
                'price' => null,
                'fetch_status' => FetchStatus::FAILED,
                'error_message' => $e->getMessage(),
                'fetched_at' => now(),
            ]);

            $source->markFailed();

            return [
                'success' => false,
                'status' => FetchStatus::FAILED,
                'error' => $e->getMessage(),
            ];
        }
    }
}
