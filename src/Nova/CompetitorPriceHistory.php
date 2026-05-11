<?php

namespace Hdrm147\PriceChecker\Nova;

use App\Nova\Product;
use Hdrm147\PriceChecker\Enums\FetchStatus;
use Laravel\Nova\Fields\Badge;
use Laravel\Nova\Fields\BelongsTo;
use Laravel\Nova\Fields\Boolean;
use Laravel\Nova\Fields\Code;
use Laravel\Nova\Fields\DateTime;
use Laravel\Nova\Fields\ID;
use Laravel\Nova\Fields\Number;
use Laravel\Nova\Fields\Text;
use Laravel\Nova\Http\Requests\NovaRequest;
use Laravel\Nova\Resource;

class CompetitorPriceHistory extends Resource
{
    public static $model = \Hdrm147\PriceChecker\Models\CompetitorPriceHistory::class;

    public static $title = 'id';

    public static $search = ['id'];

    public static $group = 'Price Monitoring';

    public static $displayInNavigation = false;

    public function fields(NovaRequest $request): array
    {
        $targetCurrency = config('price-checker.target_currency', 'IQD');

        return [
            ID::make()->sortable(),

            BelongsTo::make(__('Source'), 'source', CompetitorPriceSource::class),

            BelongsTo::make(__('Product'), 'product', Product::class),

            Text::make(__('Price'), 'price')
                ->displayUsing(fn ($value) => $value ? number_format($value).' '.$targetCurrency : '-')
                ->sortable(),

            Text::make(__('Original Price'), function () {
                if (! $this->original_price) {
                    return '-';
                }

                return number_format($this->original_price / 100, 2).' '.$this->original_currency;
            }),

            Number::make(__('Exchange Rate'), 'exchange_rate')
                ->displayUsing(fn ($value) => $value ? number_format($value, 4) : '-')
                ->hideFromIndex(),

            Badge::make(__('Status'), 'fetch_status')
                ->map([
                    FetchStatus::SUCCESS->value => 'success',
                    FetchStatus::FAILED->value => 'danger',
                    FetchStatus::UNAVAILABLE->value => 'warning',
                    FetchStatus::PRICE_NOT_FOUND->value => 'info',
                    FetchStatus::RATE_LIMITED->value => 'warning',
                    FetchStatus::TIMEOUT->value => 'danger',
                    FetchStatus::PROXY_UNAVAILABLE->value => 'warning',
                ])
                ->sortable()
                ->filterable(),

            Boolean::make(__('Available'), 'is_available')
                ->sortable(),

            Boolean::make(__('In Stock'), 'is_in_stock')
                ->hideFromIndex(),

            Text::make(__('Error'), 'error_message')
                ->hideFromIndex(),

            Code::make(__('Raw Data'), 'raw_data')
                ->json()
                ->hideFromIndex(),

            DateTime::make(__('Fetched At'), 'fetched_at')
                ->sortable(),
        ];
    }

    public static function label(): string
    {
        return __('Price History');
    }
}
