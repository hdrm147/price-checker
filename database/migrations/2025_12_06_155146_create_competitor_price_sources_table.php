<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('competitor_price_sources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('url', 1000);
            $table->string('domain');
            $table->string('store_name');
            $table->string('handler_key');
            $table->boolean('is_active')->default(true);
            $table->boolean('show_in_app')->default(false);
            $table->boolean('is_international')->default(true);
            $table->integer('priority')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamp('last_fetched_at')->nullable();
            $table->timestamp('last_successful_at')->nullable();
            $table->integer('consecutive_failures')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['product_id', 'is_active']);
            $table->index(['domain', 'is_active']);
            $table->index('handler_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('competitor_price_sources');
    }
};
