<?php

namespace Hdrm147\PriceChecker\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Renders a single detected price change. Backed by an array shape because
 * the change is computed from a pair of CompetitorPriceHistory rows
 * (current + previous) rather than a single Eloquent model.
 *
 * Expected resource payload:
 *   ['id', 'old_price', 'new_price', 'changed_at',
 *    'product_name_en', 'source_domain']
 */
class PriceChangeResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this['id'],
            'old_price' => $this['old_price'],
            'new_price' => $this['new_price'],
            'changed_at' => $this['changed_at'],
            'product' => [
                'name_en' => $this['product_name_en'],
            ],
            'source' => [
                'domain' => $this['source_domain'],
            ],
        ];
    }
}
