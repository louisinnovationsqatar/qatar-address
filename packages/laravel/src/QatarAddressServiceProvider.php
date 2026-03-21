<?php
namespace QatarAddress\Laravel;

use Illuminate\Support\ServiceProvider;
use QatarAddress\Client;

class QatarAddressServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/qatar-address.php', 'qatar-address');

        $this->app->singleton(Client::class, function ($app) {
            return new Client([
                'baseUrl' => config('qatar-address.base_url', 'https://api.qataraddress.com'),
                'timeout' => config('qatar-address.timeout', 10),
            ]);
        });

        $this->app->alias(Client::class, 'qatar-address');
    }

    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->publishes([
                __DIR__ . '/../config/qatar-address.php' => config_path('qatar-address.php'),
            ], 'qatar-address-config');
        }

        $this->app['validator']->extend('qatar_zone', function ($attribute, $value) {
            return is_numeric($value) && $value >= 1 && $value <= 98;
        }, 'The :attribute must be a valid Qatar zone number (1-98).');

        $this->app['validator']->extend('qatar_address', function ($attribute, $value, $parameters) {
            if (!is_array($value) || !isset($value['zone'])) return false;
            try {
                $client = app(Client::class);
                $result = $client->validate(
                    (int) $value['zone'],
                    isset($value['street']) ? (int) $value['street'] : null,
                    isset($value['building']) ? (int) $value['building'] : null
                );
                return $result['valid'] ?? false;
            } catch (\Exception $e) {
                return false;
            }
        }, 'The :attribute is not a valid Qatar address.');
    }
}
