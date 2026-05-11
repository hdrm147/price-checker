<?php

namespace Hdrm147\PriceChecker\Nova\Filters;

use Illuminate\Contracts\Database\Eloquent\Builder;
use Laravel\Nova\Filters\Filter;
use Laravel\Nova\Http\Requests\NovaRequest;

class CompetitorShowInAppFilter extends Filter
{
    public $component = 'select-filter';

    public $name = 'Visibility';

    public function apply(NovaRequest $request, Builder $query, mixed $value): Builder
    {
        return $query->where('show_in_app', '=', $value === 'true');
    }

    public function options(NovaRequest $request): array
    {
        return [
            'Visible in App' => 'true',
            'Hidden from App' => 'false',
        ];
    }
}
