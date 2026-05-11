<?php

namespace Hdrm147\PriceChecker\Nova\Actions;

use Hdrm147\PriceChecker\Jobs\FetchCompetitorPricesJob;
use Illuminate\Bus\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Collection;
use Laravel\Nova\Actions\Action;
use Laravel\Nova\Fields\ActionFields;
use Laravel\Nova\Http\Requests\NovaRequest;

class FetchPriceNow extends Action
{
    use InteractsWithQueue;
    use Queueable;

    public $name = 'Fetch Price Now';

    public function handle(ActionFields $fields, Collection $models): mixed
    {
        $count = 0;

        foreach ($models as $source) {
            FetchCompetitorPricesJob::dispatch(
                priceSourceId: $source->id,
                forceAll: true
            );
            $count++;
        }

        return Action::message("Price fetch job dispatched for {$count} source(s)");
    }

    public function fields(NovaRequest $request): array
    {
        return [];
    }
}
