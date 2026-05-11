<?php

namespace Hdrm147\PriceChecker;

use App\Services\CurrencyConversionService;
use Hdrm147\PriceChecker\Contracts\CurrencyConverter;
use Hdrm147\PriceChecker\Http\Middleware\Authorize;
use Hdrm147\PriceChecker\Jobs\FetchCompetitorPricesJob;
use Hdrm147\PriceChecker\Nova\CompetitorPriceHistory;
use Hdrm147\PriceChecker\Nova\CompetitorPriceSource;
use Hdrm147\PriceChecker\Nova\ProductPriceHistory;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Laravel\Nova\Nova;

class PriceCheckerServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->publishes([
            __DIR__.'/../config/price-checker.php' => config_path('price-checker.php'),
        ], 'price-checker-config');

        $this->mergeConfigFrom(__DIR__.'/../config/price-checker.php', 'price-checker');

        $this->loadMigrationsFrom(__DIR__.'/../database/migrations');

        $this->app->booted(fn () => $this->registerRoutes());

        Nova::serving(function () {
            Nova::resources([
                CompetitorPriceSource::class,
                CompetitorPriceHistory::class,
                ProductPriceHistory::class,
            ]);
        });

        $this->callAfterResolving(Schedule::class, function (Schedule $schedule) {
            $schedule->job(new FetchCompetitorPricesJob)
                ->cron(config('price-checker.fetch.cadence_cron', '0 */6 * * *'))
                ->withoutOverlapping()
                ->onOneServer()
                ->name('price-checker:fetch-competitor-prices');
        });
    }

    public function register(): void
    {
        $this->app->bind(
            CurrencyConverter::class,
            fn (Application $app) => $app->make(CurrencyConversionService::class)
        );
    }

    protected function registerRoutes(): void
    {
        /** @var Application $app */
        $app = $this->app;
        if ($app->routesAreCached()) {
            return;
        }

        Nova::router(['nova', 'nova.auth', Authorize::class], 'price-checker')
            ->group(__DIR__.'/../routes/inertia.php');

        Route::middleware(['nova', 'nova.auth', Authorize::class])
            ->prefix('nova-vendor/price-checker')
            ->group(__DIR__.'/../routes/api.php');
    }
}
