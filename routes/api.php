<?php

use Illuminate\Support\Facades\Route;
use Hdrm147\PriceChecker\Http\Controllers\PriceController;

/*
|--------------------------------------------------------------------------
| Tool API Routes
|--------------------------------------------------------------------------
|
| Here is where you may register API routes for your tool. These routes
| are loaded by the ServiceProvider of your tool. They are protected
| by your tool's "Authorize" middleware by default.
|
*/

Route::get('/products', [PriceController::class, 'products']);
Route::get('/comparison', [PriceController::class, 'comparison']);
Route::get('/prices', [PriceController::class, 'prices']);
Route::get('/changes', [PriceController::class, 'changes']);
Route::get('/jobs', [PriceController::class, 'jobs']);
Route::put('/products/{productId}/price', [PriceController::class, 'updatePrice']);
Route::post('/products/{productId}/refresh', [PriceController::class, 'refreshProduct']);
Route::post('/refresh-all', [PriceController::class, 'refreshAll']);
