<?php

namespace Hdrm147\PriceChecker\Nova;

use App\Nova\Product;
use App\Nova\User;
use Hdrm147\PriceChecker\Enums\PriceChangeSource;
use Laravel\Nova\Fields\Badge;
use Laravel\Nova\Fields\BelongsTo;
use Laravel\Nova\Fields\DateTime;
use Laravel\Nova\Fields\ID;
use Laravel\Nova\Fields\Number;
use Laravel\Nova\Fields\Text;
use Laravel\Nova\Fields\Textarea;
use Laravel\Nova\Http\Requests\NovaRequest;
use Laravel\Nova\Resource;

class ProductPriceHistory extends Resource
{
    public static $model = \Hdrm147\PriceChecker\Models\ProductPriceHistory::class;

    public static $title = 'id';

    public static $search = ['id'];

    public static $group = 'Price Monitoring';

    public function fields(NovaRequest $request): array
    {
        $targetCurrency = config('price-checker.target_currency', 'IQD');

        return [
            ID::make()->sortable(),

            BelongsTo::make(__('Product'), 'product', Product::class)
                ->searchable()
                ->sortable(),

            Text::make(__('Field'), 'field_name')
                ->displayUsing(fn ($value) => match ($value) {
                    'price' => __('Price'),
                    'discounted_price' => __('Discounted Price'),
                    default => $value,
                })
                ->sortable()
                ->filterable(),

            Text::make(__('Old Value'), 'old_value')
                ->displayUsing(fn ($value) => $value ? number_format($value).' '.$targetCurrency : '-'),

            Text::make(__('New Value'), 'new_value')
                ->displayUsing(fn ($value) => $value ? number_format($value).' '.$targetCurrency : '-'),

            Text::make(__('Change'), function () use ($targetCurrency) {
                if ($this->price_difference === null) {
                    return '-';
                }
                $prefix = $this->price_difference > 0 ? '+' : '';

                return $prefix.number_format($this->price_difference).' '.$targetCurrency;
            }),

            Number::make(__('Change %'), 'percentage_change')
                ->displayUsing(function ($value) {
                    if ($value === null) {
                        return '-';
                    }
                    $prefix = $value > 0 ? '+' : '';

                    return $prefix.number_format($value, 2).'%';
                }),

            Badge::make(__('Source'), 'change_source')
                ->map([
                    PriceChangeSource::MANUAL->value => 'info',
                    PriceChangeSource::IMPORT->value => 'warning',
                    PriceChangeSource::API->value => 'success',
                    PriceChangeSource::DEAL->value => 'primary',
                    PriceChangeSource::BULK->value => 'secondary',
                ])
                ->sortable()
                ->filterable(),

            BelongsTo::make(__('Changed By'), 'changedBy', User::class)
                ->nullable()
                ->hideFromIndex(),

            Textarea::make(__('Notes'), 'notes')
                ->hideFromIndex(),

            DateTime::make(__('Changed At'), 'changed_at')
                ->sortable(),
        ];
    }

    public static function label(): string
    {
        return __('Price Changes');
    }

    public static function singularLabel(): string
    {
        return __('Price Change');
    }
}
