<?php

namespace Hdrm147\PriceChecker\Http\Controllers;

use Hdrm147\PriceChecker\Enums\FetchStatus;
use Hdrm147\PriceChecker\Http\Resources\ComparisonResource;
use Hdrm147\PriceChecker\Http\Resources\JobStatusResource;
use Hdrm147\PriceChecker\Http\Resources\PriceChangeResource;
use Hdrm147\PriceChecker\Http\Resources\ProductResource;
use Hdrm147\PriceChecker\Jobs\FetchCompetitorPricesJob;
use Hdrm147\PriceChecker\Models\CompetitorPriceHistory;
use Hdrm147\PriceChecker\Models\CompetitorPriceSource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class PriceController extends Controller
{
    /**
     * Products that have at least one competitor source attached.
     * Vue: /products → response.data.products[]{ id, name_en, sku }
     */
    public function products(Request $request): JsonResponse
    {
        $productModel = config('price-checker.product_model');

        $products = $productModel::query()
            ->withoutGlobalScopes()
            ->whereHas('competitorPriceSources')
            ->orderBy('name_en')
            ->get(['id', 'name_en', 'sku']);

        return response()->json(['products' => ProductResource::collection($products)]);
    }

    /**
     * Per-product comparison grid.
     * Vue: /comparison[?productId=X] → response.data.data[]{ product_id, …, competitors[]{…} }
     */
    public function comparison(Request $request): JsonResponse
    {
        $productModel = config('price-checker.product_model');

        $rows = $productModel::query()
            ->withoutGlobalScopes()
            ->whereHas('activeCompetitorSources')
            ->when(
                $request->input('productId'),
                fn ($q, $id) => $q->where('id', (int) $id)
            )
            ->with(['activeCompetitorSources' => fn ($q) => $q->orderBy('priority', 'desc'), 'activeCompetitorSources.latestPrice'])
            ->orderBy('name_en')
            ->get();

        return response()->json([
            'data' => ComparisonResource::collection($rows),
            'error' => null,
        ]);
    }

    /**
     * Recent successful fetches whose price differs from the previous
     * successful fetch for the same source.
     * Vue: /changes → response.data.changes[]{ id, old_price, new_price, … }
     */
    public function changes(Request $request): JsonResponse
    {
        $since = $request->input('since', now()->subDays(7)->toIso8601String());

        $rows = CompetitorPriceHistory::query()
            ->where('fetch_status', FetchStatus::SUCCESS)
            ->where('fetched_at', '>=', $since)
            ->with(['source', 'product:id,name_en'])
            ->orderBy('competitor_price_source_id')
            ->orderBy('fetched_at')
            ->get();

        $changes = [];
        $lastPriceBySource = [];

        foreach ($rows as $row) {
            $sourceId = $row->competitor_price_source_id;
            $prev = $lastPriceBySource[$sourceId] ?? null;

            if ($prev !== null && $row->price !== null && $row->price !== $prev) {
                $changes[] = [
                    'id' => $row->id,
                    'old_price' => $prev,
                    'new_price' => $row->price,
                    'changed_at' => $row->fetched_at?->toIso8601String(),
                    'product_name_en' => $row->product?->name_en,
                    'source_domain' => $row->source?->domain,
                ];
            }

            if ($row->price !== null) {
                $lastPriceBySource[$sourceId] = $row->price;
            }
        }

        usort($changes, fn ($a, $b) => strcmp($b['changed_at'] ?? '', $a['changed_at'] ?? ''));
        $changes = array_slice($changes, 0, 200);

        return response()->json(['changes' => PriceChangeResource::collection(collect($changes))]);
    }

    /**
     * Source-level last-fetch state for the queue widget.
     * Vue: /jobs → response.data.jobs[]{ id, domain, product_name, status, price, … }
     */
    public function jobs(Request $request): JsonResponse
    {
        $sources = CompetitorPriceSource::query()
            ->with(['product:id,name_en', 'latestPrice'])
            ->orderByRaw('last_fetched_at DESC NULLS FIRST')
            ->limit(100)
            ->get();

        return response()->json(['jobs' => JobStatusResource::collection($sources)]);
    }

    /**
     * Vue: PUT /products/{id}/price body { price } — accept-competitor-price action.
     * Writes directly to the host's Product model (configurable). Bypasses
     * global scopes + observers to mirror the legacy behavior.
     */
    public function updatePrice(Request $request, $productId): JsonResponse
    {
        $request->validate(['price' => 'required|numeric|min:0']);

        $productModel = config('price-checker.product_model');
        $product = $productModel::query()->withoutGlobalScopes()->find($productId);

        if (! $product) {
            return response()->json([
                'error' => 'Product not found',
                'product_id' => $productId,
            ], 404);
        }

        $oldPrice = $product->price;
        $product->price = (int) $request->input('price');
        $product->saveQuietly();

        return response()->json([
            'success' => true,
            'product_id' => (int) $productId,
            'old_price' => $oldPrice,
            'new_price' => $product->price,
        ]);
    }

    /**
     * Vue: POST /products/{id}/refresh — queue a fetch for every active
     * competitor source attached to this product.
     */
    public function refreshProduct(Request $request, $productId): JsonResponse
    {
        $sources = CompetitorPriceSource::query()
            ->where('product_id', (int) $productId)
            ->active()
            ->get(['id']);

        foreach ($sources as $source) {
            FetchCompetitorPricesJob::dispatch(priceSourceId: $source->id, forceAll: true);
        }

        return response()->json([
            'queued' => true,
            'product_id' => (int) $productId,
            'sources_queued' => $sources->count(),
        ]);
    }

    /**
     * Vue: POST /refresh-all → response.data.sources_queued (number).
     */
    public function refreshAll(Request $request): JsonResponse
    {
        $hoursThreshold = (int) config('price-checker.fetch.hours_threshold', 6);

        $count = CompetitorPriceSource::query()
            ->active()
            ->dueFetch($hoursThreshold)
            ->count();

        FetchCompetitorPricesJob::dispatch(forceAll: false, hoursThreshold: $hoursThreshold);

        return response()->json([
            'queued' => true,
            'sources_queued' => $count,
        ]);
    }
}
