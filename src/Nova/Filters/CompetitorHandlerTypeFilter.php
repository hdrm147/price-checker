<?php

namespace Hdrm147\PriceChecker\Nova\Filters;

use Illuminate\Contracts\Database\Eloquent\Builder;
use Laravel\Nova\Filters\Filter;
use Laravel\Nova\Http\Requests\NovaRequest;

class CompetitorHandlerTypeFilter extends Filter
{
    public $component = 'select-filter';

    public $name = 'Handler Type';

    public function apply(NovaRequest $request, Builder $query, mixed $value): Builder
    {
        return $query->where('handler_key', '=', $value);
    }

    public function options(NovaRequest $request): array
    {
        return [
            'Amazon' => 'amazon',
            'Newegg' => 'newegg',
            'Generic / Local' => 'generic',
        ];
    }
}
