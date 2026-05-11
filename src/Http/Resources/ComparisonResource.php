<?php

namespace Hdrm147\PriceChecker\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ComparisonResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'product_id' => $this->id,
            'product_name' => $this->name_en,
            'sku' => $this->sku,
            'our_price' => $this->discounted_price ?? $this->price,
            'competitors' => $this->whenLoaded('activeCompetitorSources', function () {
                return $this->activeCompetitorSources->map(function ($source) {
                    $latest = $source->latestPrice;

                    return [
                        'source_id' => (string) $source->id,
                        'domain' => $source->domain,
                        'url' => $source->url,
                        'price' => $latest?->price,
                        'in_stock' => (bool) ($latest?->is_in_stock ?? false),
                        'checked_at' => $latest?->fetched_at?->toIso8601String(),
                    ];
                })->values()->all();
            }, []),
        ];
    }
}
