<?php

namespace Hdrm147\PriceChecker\Nova\Filters;

use Illuminate\Contracts\Database\Eloquent\Builder;
use Laravel\Nova\Filters\Filter;
use Laravel\Nova\Http\Requests\NovaRequest;

class CompetitorIsInternationalFilter extends Filter
{
    public $component = 'select-filter';

    public $name = 'Store Type';

    public function apply(NovaRequest $request, Builder $query, mixed $value): Builder
    {
        return $query->where('is_international', '=', $value === 'true');
    }

    public function options(NovaRequest $request): array
    {
        return [
            'International' => 'true',
            'Local (Iraqi)' => 'false',
        ];
    }
}
