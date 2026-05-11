<?php

namespace Hdrm147\PriceChecker\Nova;

use App\Nova\Product;
use Hdrm147\PriceChecker\Nova\Actions\FetchPriceNow;
use Hdrm147\PriceChecker\Nova\Filters\CompetitorHandlerTypeFilter;
use Hdrm147\PriceChecker\Nova\Filters\CompetitorIsInternationalFilter;
use Hdrm147\PriceChecker\Nova\Filters\CompetitorShowInAppFilter;
use Laravel\Nova\Fields\BelongsTo;
use Laravel\Nova\Fields\Boolean;
use Laravel\Nova\Fields\DateTime;
use Laravel\Nova\Fields\HasMany;
use Laravel\Nova\Fields\ID;
use Laravel\Nova\Fields\KeyValue;
use Laravel\Nova\Fields\Number;
use Laravel\Nova\Fields\Select;
use Laravel\Nova\Fields\Text;
use Laravel\Nova\Fields\URL;
use Laravel\Nova\Http\Requests\NovaRequest;
use Laravel\Nova\Resource;

class CompetitorPriceSource extends Resource
{
    public static $model = \Hdrm147\PriceChecker\Models\CompetitorPriceSource::class;

    public static $title = 'store_name';

    public static $search = ['id', 'url', 'store_name', 'domain'];

    public static $group = 'Price Monitoring';

    public function fields(NovaRequest $request): array
    {
        return [
            ID::make()->sortable(),

            BelongsTo::make(__('Product'), 'product', Product::class)
                ->searchable()
                ->sortable(),

            URL::make(__('URL'), 'url')
                ->displayUsing(fn ($value) => strlen($value) > 50 ? substr($value, 0, 50).'...' : $value)
                ->rules('required', 'max:1000'),

            Text::make(__('Domain'), 'domain')
                ->sortable()
                ->readonly()
                ->hideWhenCreating(),

            Text::make(__('Store Name'), 'store_name')
                ->sortable()
                ->rules('required', 'max:100'),

            Select::make(__('Handler'), 'handler_key')
                ->options([
                    'amazon' => 'Amazon',
                    'newegg' => 'Newegg',
                    'generic' => 'Generic / Local',
                ])
                ->displayUsingLabels()
                ->rules('required'),

            Boolean::make(__('Active'), 'is_active')
                ->sortable()
                ->filterable(),

            Boolean::make(__('Show in App'), 'show_in_app')
                ->help(__('Display this price to customers in mobile app'))
                ->sortable()
                ->filterable(),

            Boolean::make(__('International'), 'is_international')
                ->sortable()
                ->filterable(),

            Number::make(__('Priority'), 'priority')
                ->help(__('Higher priority sources shown first'))
                ->default(0)
                ->hideFromIndex(),

            KeyValue::make(__('Metadata'), 'metadata')
                ->help(__('Custom configuration (price_selector, currency, etc.)'))
                ->nullable()
                ->hideFromIndex(),

            Number::make(__('Failures'), 'consecutive_failures')
                ->readonly()
                ->exceptOnForms(),

            DateTime::make(__('Last Fetched'), 'last_fetched_at')
                ->readonly()
                ->exceptOnForms()
                ->sortable(),

            DateTime::make(__('Last Success'), 'last_successful_at')
                ->readonly()
                ->exceptOnForms()
                ->hideFromIndex(),

            Text::make(__('Latest Price'), function () {
                $latest = $this->latestPrice;
                if (! $latest) {
                    return '-';
                }

                return number_format($latest->price).' '.config('price-checker.target_currency', 'IQD');
            })->exceptOnForms(),

            HasMany::make(__('Price History'), 'priceHistory', CompetitorPriceHistory::class),
        ];
    }

    public function filters(NovaRequest $request): array
    {
        return [
            new CompetitorHandlerTypeFilter,
            new CompetitorIsInternationalFilter,
            new CompetitorShowInAppFilter,
        ];
    }

    public function actions(NovaRequest $request): array
    {
        return [
            new FetchPriceNow,
        ];
    }

    public static function label(): string
    {
        return __('Price Sources');
    }

    public static function singularLabel(): string
    {
        return __('Price Source');
    }
}
