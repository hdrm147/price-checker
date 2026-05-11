<?php

namespace Hdrm147\PriceChecker\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Job/queue widget row, derived from a CompetitorPriceSource + its latest
 * fetch state. Status is computed from last_fetched_at / last_successful_at
 * / consecutive_failures rather than read from a separate jobs table.
 */
class JobStatusResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'domain' => $this->domain,
            'product_id' => $this->product_id,
            'product_name' => $this->product?->name_en,
            'status' => $this->derivedStatus(),
            'price' => $this->latestPrice?->price,
            'checked_at' => $this->last_fetched_at?->toIso8601String(),
            'next_check_at' => $this->nextCheckAt(),
        ];
    }

    protected function derivedStatus(): string
    {
        if ($this->last_fetched_at === null) {
            return 'pending';
        }

        if ($this->consecutive_failures > 0) {
            return 'failed';
        }

        return 'completed';
    }

    protected function nextCheckAt(): ?string
    {
        $cadence = (int) config('price-checker.fetch.hours_threshold', 6);

        return $this->last_fetched_at?->copy()->addHours($cadence)->toIso8601String();
    }
}
