<?php
namespace QatarAddress\Laravel\Facades;

use Illuminate\Support\Facades\Facade;
use QatarAddress\Client;

class QatarAddress extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return Client::class;
    }
}
