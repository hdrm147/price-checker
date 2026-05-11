<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('competitor_price_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('competitor_price_source_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->integer('price')->nullable();
            $table->integer('original_price')->nullable();
            $table->string('original_currency', 10)->default('USD');
            $table->decimal('exchange_rate', 12, 4)->nullable();
            $table->boolean('is_available')->default(true);
            $table->boolean('is_in_stock')->nullable();
            $table->string('fetch_status');
            $table->text('error_message')->nullable();
            $table->json('raw_data')->nullable();
            $table->timestamp('fetched_at');
            $table->timestamps();

            $table->index(['competitor_price_source_id', 'fetched_at']);
            $table->index(['product_id', 'fetched_at']);
            $table->index('fetched_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('competitor_price_history');
    }
};
