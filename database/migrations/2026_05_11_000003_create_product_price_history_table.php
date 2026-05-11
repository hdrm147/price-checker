<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_price_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('field_name');
            $table->integer('old_value')->nullable();
            $table->integer('new_value')->nullable();
            $table->integer('price_difference')->nullable();
            $table->decimal('percentage_change', 8, 2)->nullable();
            $table->string('change_source')->default('manual');
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('changed_at');
            $table->timestamps();

            $table->index(['product_id', 'changed_at']);
            $table->index(['field_name', 'changed_at']);
            $table->index('changed_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_price_history');
    }
};
