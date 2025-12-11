<?php

namespace Hdrm147\PriceChecker\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Hdrm147\PriceChecker\Services\PriceApiClient;

class PriceController extends Controller
{
    protected PriceApiClient $apiClient;

    public function __construct()
    {
        $this->apiClient = new PriceApiClient();
    }

    /**
     * Get all products with price sources.
     */
    public function products(Request $request)
    {
        $data = $this->apiClient->getProducts($request->all());

        return response()->json($data);
    }

    /**
     * Get price comparison data grouped by product.
     */
    public function comparison(Request $request)
    {
        $data = $this->apiClient->getComparison($request->all());

        return response()->json($data);
    }

    /**
     * Get all current prices.
     */
    public function prices(Request $request)
    {
        $data = $this->apiClient->getPrices($request->all());

        return response()->json($data);
    }

    /**
     * Get recent price changes.
     */
    public function changes(Request $request)
    {
        $since = $request->input('since');
        $data = $this->apiClient->getChanges($since);

        return response()->json($data);
    }

    /**
     * Get jobs/queue status.
     */
    public function jobs(Request $request)
    {
        $data = $this->apiClient->getJobs($request->all());

        return response()->json($data);
    }

    /**
     * Update product price on the main backend.
     */
    public function updatePrice(Request $request, $productId)
    {
        $request->validate([
            'price' => 'required|numeric|min:0',
        ]);

        // Update the product price directly on the main backend's products table
        // Use withTrashed in case SoftDeletes is enabled
        $product = \App\Models\Product::withoutGlobalScopes()->find($productId);

        if (!$product) {
            return response()->json([
                'error' => 'Product not found',
                'product_id' => $productId,
            ], 404);
        }

        $oldPrice = $product->price;
        $product->price = (int) $request->input('price');
        $product->saveQuietly(); // Skip observers/events to avoid side effects

        return response()->json([
            'success' => true,
            'product_id' => $productId,
            'old_price' => $oldPrice,
            'new_price' => $product->price,
        ]);
    }

    /**
     * Refresh all sources for a product (queue for immediate re-check).
     */
    public function refreshProduct(Request $request, $productId)
    {
        $data = $this->apiClient->refreshProduct((int) $productId);

        return response()->json($data);
    }

    /**
     * Refresh ALL price sources (queue all for immediate re-check).
     */
    public function refreshAll(Request $request)
    {
        $data = $this->apiClient->refreshAll();

        return response()->json($data);
    }
}
