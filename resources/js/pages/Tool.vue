<template>
  <div class="price-checker-dashboard">
    <Head title="Price Checker" />

    <!-- Main Content -->
    <div class="main-content">
      <!-- Filters Panel -->
      <div class="filters-panel">
        <div class="filter-row">
          <div class="filter-group search-group">
            <PrimeInputText
              v-model="searchQuery"
              placeholder="Search products..."
              class="search-input"
            />
          </div>
          <div class="filter-actions">
            <PrimeButton
              icon="pi pi-refresh"
              label="Refresh All"
              :loading="loading"
              @click="fetchComparison"
              class="p-button-primary"
              severity="primary"
            />
          </div>
        </div>
        <div class="filter-bar">
          <div class="segment-control">
            <button
              class="segment"
              :class="{ active: activeFilter === 'all' }"
              @click="setFilter('all')"
            >
              <span class="segment-label">All</span>
              <span class="segment-count">{{ comparisonData.length }}</span>
            </button>
            <button
              class="segment segment-cheapest"
              :class="{ active: activeFilter === 'cheapest' }"
              @click="setFilter('cheapest')"
            >
              <span class="segment-dot cheapest"></span>
              <span class="segment-label">Cheapest</span>
              <span class="segment-count">{{ positionCounts.cheapest }}</span>
            </button>
            <button
              class="segment segment-competitive"
              :class="{ active: activeFilter === 'competitive' }"
              @click="setFilter('competitive')"
            >
              <span class="segment-dot competitive"></span>
              <span class="segment-label">Competitive</span>
              <span class="segment-count">{{ positionCounts.competitive }}</span>
            </button>
            <button
              class="segment segment-expensive"
              :class="{ active: activeFilter === 'expensive' }"
              @click="setFilter('expensive')"
            >
              <span class="segment-dot expensive"></span>
              <span class="segment-label">Expensive</span>
              <span class="segment-count">{{ positionCounts.expensive }}</span>
            </button>
            <button
              class="segment segment-nodata"
              :class="{ active: activeFilter === 'nodata' }"
              @click="setFilter('nodata')"
            >
              <span class="segment-dot nodata"></span>
              <span class="segment-label">No Data</span>
              <span class="segment-count">{{ positionCounts.none }}</span>
            </button>
          </div>
          <div class="server-status" :class="serverStatus">
            <span class="status-dot"></span>
            <span class="status-text">{{ serverStatusText }}</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <PrimeTabView v-model:activeIndex="activeTabIndex">
        <PrimeTabPanel>
          <template #header>
            <div class="tab-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              <span>Price Comparison</span>
            </div>
          </template>

          <!-- Loading State -->
          <div v-if="loading" class="loading-state">
            <PrimeSkeleton v-for="i in 3" :key="i" height="200px" class="mb-4" />
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="error-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            <span>{{ error }}</span>
            <PrimeButton label="Retry" @click="fetchComparison" class="p-button-sm" />
          </div>

          <!-- Empty State -->
          <div v-else-if="filteredProducts.length === 0" class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            <span>No products found</span>
          </div>

          <!-- Product Cards Grid with Pagination -->
          <div v-else>
            <div class="products-grid">
              <div v-for="product in paginatedProducts" :key="product.product_id" class="product-card" :class="getCardClass(product)">
                <!-- Card Header -->
                <div class="card-header">
                  <div class="product-info">
                    <h3 class="product-name">{{ product.product_name }}</h3>
                    <span class="product-sku">{{ product.sku }}</span>
                  </div>
                  <div class="our-price-badge">
                    <span class="our-price-label">OUR PRICE</span>
                    <span class="our-price-value">{{ formatPrice(product.our_price) }}</span>
                  </div>
                </div>

                <!-- Card Body -->
                <div class="card-body">
                  <!-- No competitors -->
                  <div v-if="!product.competitors || product.competitors.length === 0" class="no-competitors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                    <span>No competitor prices yet</span>
                  </div>

                  <template v-else>
                    <!-- Position Summary -->
                    <div class="position-summary" :class="getPricePosition(product).class">
                      <div class="position-icon">
                        <svg v-if="getPricePosition(product).icon === 'trophy'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                        <svg v-else-if="getPricePosition(product).icon === 'up'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>
                        <svg v-else-if="getPricePosition(product).icon === 'down'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>
                      </div>
                      <div class="position-text">
                        <span class="position-label">{{ getPricePosition(product).label }}</span>
                        <span class="position-detail">{{ getPricePosition(product).detail }}</span>
                      </div>
                    </div>

                    <!-- Competitors List -->
                    <div class="competitors-list">
                      <div
                        v-for="(item, index) in getSortedPricesWithOurs(product)"
                        :key="item.key"
                        :class="['competitor-row', { 'is-ours': item.isOurs, 'is-cheapest': index === 0 && !item.isOurs, 'is-expensive': index === getSortedPricesWithOurs(product).length - 1 && !item.isOurs }]"
                      >
                        <div class="competitor-rank" :class="{ 'rank-1': index === 0, 'rank-last': index === getSortedPricesWithOurs(product).length - 1 }">
                          {{ index + 1 }}
                        </div>
                        <div class="competitor-info">
                          <a
                            v-if="!item.isOurs && item.url"
                            :href="item.url"
                            target="_blank"
                            rel="noopener"
                            class="competitor-name competitor-link"
                            @click.stop
                          >
                            {{ item.domain }}
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                          </a>
                          <span v-else class="competitor-name" :class="{ 'our-name': item.isOurs }">
                            {{ item.isOurs ? '★ Our Price' : item.domain }}
                          </span>
                          <span v-if="!item.isOurs && item.checked_at" class="competitor-time">
                            {{ formatTime(item.checked_at) }}
                          </span>
                        </div>
                        <div class="competitor-price">
                          <span class="price-value" :class="{ 'price-ours': item.isOurs }">{{ formatPrice(item.price) }}</span>
                          <span v-if="!item.isOurs && item.diffAmount !== 0" class="diff-amount" :class="item.diffAmount < 0 ? 'cheaper' : 'expensive'">
                            {{ item.diffAmount > 0 ? '+' : '' }}{{ formatPrice(item.diffAmount) }}
                          </span>
                          <span v-if="!item.isOurs && item.diff !== 0" class="diff-badge" :class="item.diff < 0 ? 'cheaper' : 'expensive'">
                            {{ formatDiffPercent(item.diff) }}
                          </span>
                          <span v-if="!item.isOurs && !item.in_stock" class="oos-badge">OOS</span>
                        </div>
                      </div>
                    </div>
                  </template>
                </div>

                <!-- Card Footer Actions -->
                <div class="card-footer">
                  <button class="action-btn primary" @click="openPriceModal(product)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    <span>Change Price</span>
                  </button>
                  <button class="action-btn" @click="refreshProduct(product)" :disabled="refreshingProducts.has(product.product_id)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
                    <span>{{ refreshingProducts.has(product.product_id) ? 'Refreshing...' : 'Refresh' }}</span>
                  </button>
                  <a :href="getProductUrl(product)" target="_blank" class="action-btn">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
                    <span>View</span>
                  </a>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div v-if="totalPages > 1" class="pagination-wrapper">
              <PrimePaginator
                :rows="itemsPerPage"
                :totalRecords="filteredProducts.length"
                :first="(currentPage - 1) * itemsPerPage"
                @page="onPageChange"
                template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
              />
            </div>
          </div>
        </PrimeTabPanel>

        <PrimeTabPanel>
          <template #header>
            <div class="tab-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              <span>Price Changes</span>
              <PrimeTag v-if="recentChanges.length > 0" :value="String(recentChanges.length)" severity="danger" class="tab-badge" />
            </div>
          </template>

          <div v-if="recentChanges.length === 0" class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>No price changes in the last 24 hours</span>
          </div>

          <div v-else class="changes-list">
            <div v-for="change in recentChanges" :key="change.id" class="change-card">
              <div class="change-icon" :class="change.new_price < change.old_price ? 'down' : 'up'">
                <svg v-if="change.new_price < change.old_price" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              </div>
              <div class="change-details">
                <span class="change-product">{{ change.product?.name_en || 'Unknown Product' }}</span>
                <span class="change-store">{{ change.source?.domain }}</span>
              </div>
              <div class="change-prices">
                <span class="old-price">{{ formatPrice(change.old_price) }}</span>
                <span class="arrow">→</span>
                <span class="new-price" :class="change.new_price < change.old_price ? 'decreased' : 'increased'">
                  {{ formatPrice(change.new_price) }}
                </span>
              </div>
              <PrimeTag
                :value="formatDiff(change.old_price, change.new_price)"
                :severity="change.new_price < change.old_price ? 'success' : 'danger'"
              />
              <span class="change-time">{{ formatTime(change.changed_at) }}</span>
            </div>
          </div>
        </PrimeTabPanel>

        <PrimeTabPanel>
          <template #header>
            <div class="tab-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
              <span>Queue Status</span>
            </div>
          </template>

          <div v-if="loadingJobs" class="loading-state">
            <PrimeSkeleton v-for="i in 5" :key="i" height="60px" class="mb-2" />
          </div>

          <div v-else-if="jobs.length === 0" class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span>Queue is empty</span>
          </div>

          <PrimeDataTable v-else :value="jobs" :paginator="true" :rows="20" class="jobs-table">
            <PrimeColumn field="domain" header="Store" sortable>
              <template #body="{ data }">
                <span class="job-domain">{{ data.domain }}</span>
              </template>
            </PrimeColumn>
            <PrimeColumn field="product_name" header="Product" sortable>
              <template #body="{ data }">
                <span class="job-product">{{ data.product_name || data.product_id }}</span>
              </template>
            </PrimeColumn>
            <PrimeColumn field="status" header="Status" sortable>
              <template #body="{ data }">
                <PrimeTag :value="data.status" :severity="getStatusSeverity(data.status)" />
              </template>
            </PrimeColumn>
            <PrimeColumn field="price" header="Price" sortable>
              <template #body="{ data }">
                <span v-if="data.price" class="job-price">{{ formatPrice(data.price) }}</span>
                <span v-else class="no-price">-</span>
              </template>
            </PrimeColumn>
            <PrimeColumn field="checked_at" header="Last Check" sortable>
              <template #body="{ data }">
                <span class="job-time">{{ formatTime(data.checked_at || data.next_check_at) }}</span>
              </template>
            </PrimeColumn>
          </PrimeDataTable>
        </PrimeTabPanel>
      </PrimeTabView>
    </div>

    <!-- Price Change Modal -->
    <PrimeDialog
      v-model:visible="priceModalVisible"
      :header="priceModalProduct?.product_name || 'Change Price'"
      :modal="true"
      :closable="true"
      :draggable="false"
      class="price-modal"
      :style="{ width: '480px' }"
    >
      <div v-if="priceModalProduct" class="price-modal-content">
        <!-- Current Prices Info -->
        <div class="price-info-row">
          <div class="price-info-item current">
            <span class="price-info-label">Current Price</span>
            <span class="price-info-value">{{ formatPrice(priceModalProduct.our_price) }}</span>
          </div>
          <div class="price-info-item cheapest">
            <span class="price-info-label">Cheapest Competitor</span>
            <span class="price-info-value" :class="{ 'no-data': !cheapestCompetitorPrice }">
              {{ cheapestCompetitorPrice ? formatPrice(cheapestCompetitorPrice) : 'N/A' }}
            </span>
          </div>
        </div>

        <!-- Price Change Options -->
        <div class="price-options">
          <!-- Option 1: Manual Price -->
          <div class="price-option">
            <label class="option-label">
              <input type="radio" v-model="priceChangeMode" value="manual" />
              <span>Enter Price Manually</span>
            </label>
            <div v-if="priceChangeMode === 'manual'" class="option-input">
              <PrimeInputNumber
                v-model="manualPrice"
                :min="0"
                :maxFractionDigits="0"
                placeholder="Enter new price"
                class="price-input"
              />
              <span class="input-suffix">IQD</span>
            </div>
          </div>

          <!-- Option 2: Margin from Cheapest -->
          <div class="price-option" :class="{ disabled: !cheapestCompetitorPrice }">
            <label class="option-label">
              <input type="radio" v-model="priceChangeMode" value="margin" :disabled="!cheapestCompetitorPrice" />
              <span>Profit Margin from Cheapest</span>
            </label>
            <div v-if="priceChangeMode === 'margin'" class="option-input margin-input">
              <PrimeInputNumber
                v-model="profitMargin"
                :min="-50"
                :max="100"
                suffix="%"
                placeholder="e.g. 5"
                class="margin-input-field"
              />
              <span class="calculated-price" v-if="calculatedMarginPrice">
                = {{ formatPrice(calculatedMarginPrice) }}
              </span>
            </div>
          </div>

          <!-- Option 3: Match Cheapest -->
          <div class="price-option" :class="{ disabled: !cheapestCompetitorPrice }">
            <label class="option-label">
              <input type="radio" v-model="priceChangeMode" value="match" :disabled="!cheapestCompetitorPrice" />
              <span>Match Cheapest Price</span>
              <span v-if="cheapestCompetitorPrice" class="match-price">{{ formatPrice(cheapestCompetitorPrice) }}</span>
            </label>
          </div>
        </div>

        <!-- New Price Preview -->
        <div v-if="newPricePreview" class="new-price-preview">
          <span class="preview-label">New Price:</span>
          <span class="preview-value">{{ formatPrice(newPricePreview) }}</span>
          <span v-if="priceDifference !== 0" class="preview-diff" :class="priceDifference < 0 ? 'decrease' : 'increase'">
            {{ priceDifference > 0 ? '+' : '' }}{{ formatPrice(priceDifference) }}
            ({{ priceDifferencePercent }})
          </span>
        </div>
      </div>

      <template #footer>
        <div class="modal-footer">
          <PrimeButton label="Cancel" class="p-button-text" @click="closePriceModal" />
          <PrimeButton
            label="Update Price"
            class="p-button-primary"
            :loading="updatingPrice"
            :disabled="!newPricePreview || newPricePreview === priceModalProduct?.our_price"
            @click="submitPriceChange"
          />
        </div>
      </template>
    </PrimeDialog>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted, onUnmounted, watch, shallowRef, triggerRef } from 'vue'

export default {
  setup() {
    const products = ref([])
    const selectedProducts = ref([])
    const searchQuery = ref('')
    const debouncedSearchQuery = ref('')
    const activeFilter = ref('all') // 'all', 'cheapest', 'competitive', 'expensive', 'nodata'
    const comparisonData = shallowRef([])
    const recentChanges = ref([])
    const jobs = ref([])
    const loading = ref(true)
    const loadingJobs = ref(false)
    const error = ref(null)
    const activeTabIndex = ref(0)
    const serverStatus = ref('unknown')
    const refreshInterval = ref(null)
    const refreshingProducts = reactive(new Set())
    const currentPage = ref(1)
    const itemsPerPage = 12

    // Debounce search query
    let searchTimeout = null
    watch(searchQuery, (newVal) => {
      if (searchTimeout) clearTimeout(searchTimeout)
      searchTimeout = setTimeout(() => {
        debouncedSearchQuery.value = newVal
      }, 150)
    })

    // Store name mapping for better display
    const storeNameMap = {
      'store.alnabaa.com': 'Al-Nabaa',
      'globaliraq.net': 'Global Iraq',
      'kolshzin.com': 'Kolsh Zin',
      'alityan.com': 'Alityan',
      'anas-iq.com': 'Anas Iraq',
      '3d-iraq.com': '3D Iraq',
      'alfarah-store.com': 'Al-Farah',
      'alfawaz.com.iq': 'Al-Fawaz',
      'galaxy-iq.com': 'Galaxy Iraq',
      'miswag.com': 'Miswag',
      'mizzostore.com': 'Mizzo',
      'tt-tab.net': 'TT-Tab',
      'menairq.com': 'Mena Iraq',
      'alemanmarket.com': 'Aleman Market',
      'un4shop.com': 'UN4 Shop',
      'elryan.com': 'El-Ryan',
      'wajidiraq.com': 'Wajid Iraq',
      'alamani.iq': 'Alamani',
      'toolmart.me': 'Tool Mart',
      'amazon.com': 'Amazon US',
      'amazon.com.tr': 'Amazon TR',
      'newegg.com': 'Newegg',
    }

    const getStoreName = (domain) => {
      if (!domain) return 'Unknown'
      const cleanDomain = domain.replace('www.', '').toLowerCase()
      return storeNameMap[cleanDomain] || cleanDomain
    }

    // Price modal state
    const priceModalVisible = ref(false)
    const priceModalProduct = ref(null)
    const priceChangeMode = ref('manual')
    const manualPrice = ref(null)
    const profitMargin = ref(-5)
    const updatingPrice = ref(false)

    const positionOptions = [
      { label: 'All Positions', value: null },
      { label: 'Cheapest', value: 'cheapest' },
      { label: 'Competitive', value: 'competitive' },
      { label: 'Expensive', value: 'expensive' },
    ]

    const competitorOptions = [
      { label: 'All Products', value: null },
      { label: 'Has Competitors', value: true },
      { label: 'No Competitors', value: false },
    ]

    const productOptions = computed(() => {
      return products.value.map(p => ({
        label: `${p.name_en} (${p.sku})`,
        value: p.id
      }))
    })

    const totalSources = computed(() => {
      let count = 0
      comparisonData.value.forEach(p => {
        count += p.competitors?.length || 0
      })
      return count
    })

    const serverStatusText = computed(() => {
      switch (serverStatus.value) {
        case 'online': return 'Online'
        case 'offline': return 'Offline'
        default: return 'Checking...'
      }
    })

    // Competitive threshold: within 10% of cheapest competitor
    const COMPETITIVE_THRESHOLD = 10

    const getProductPosition = (product) => {
      // Check if product has any valid competitor prices
      const hasValidCompetitors = product.competitors && product.competitors.some(c => c.price)
      if (!hasValidCompetitors) return 'none'

      const ourPrice = product.our_price
      if (!ourPrice) return 'none'

      // Find cheapest competitor price
      const competitorPrices = product.competitors
        .filter(c => c.price)
        .map(c => c.price)

      if (competitorPrices.length === 0) return 'none'

      const cheapestCompetitor = Math.min(...competitorPrices)

      // Compare our price to cheapest competitor
      if (ourPrice <= cheapestCompetitor) {
        return 'cheapest' // We're the lowest or tied
      }

      // Calculate how much more expensive we are (percentage)
      const priceDiffPercent = ((ourPrice - cheapestCompetitor) / cheapestCompetitor) * 100

      if (priceDiffPercent <= COMPETITIVE_THRESHOLD) {
        return 'competitive' // Within 10% of cheapest
      }

      return 'expensive' // More than 10% above cheapest
    }

    // Count products by position for filter pills (with stable reference)
    const positionCounts = computed(() => {
      const data = comparisonData.value
      if (!data || data.length === 0) {
        return { cheapest: 0, competitive: 0, expensive: 0, none: 0 }
      }
      const counts = { cheapest: 0, competitive: 0, expensive: 0, none: 0 }
      data.forEach(product => {
        const pos = getProductPosition(product)
        if (pos in counts) {
          counts[pos]++
        }
      })
      return counts
    })

    // Set filter with radio-like behavior (mutually exclusive)
    const setFilter = (filter) => {
      activeFilter.value = filter
      currentPage.value = 1
    }

    const filteredProducts = computed(() => {
      const data = comparisonData.value
      if (!data || data.length === 0) return []

      let result = [...data] // Create a copy for filtering

      // Filter by selected products
      if (selectedProducts.value.length > 0) {
        result = result.filter(p => selectedProducts.value.includes(p.product_id))
      }

      // Filter by search query (debounced)
      if (debouncedSearchQuery.value) {
        const query = debouncedSearchQuery.value.toLowerCase()
        result = result.filter(p =>
          p.product_name?.toLowerCase().includes(query) ||
          p.sku?.toLowerCase().includes(query)
        )
      }

      // Filter by active filter (radio-like, mutually exclusive)
      if (activeFilter.value !== 'all') {
        result = result.filter(p => {
          const pos = getProductPosition(p)
          if (activeFilter.value === 'nodata') {
            return pos === 'none'
          }
          return pos === activeFilter.value
        })
      }

      return result
    })

    const totalPages = computed(() => Math.ceil(filteredProducts.value.length / itemsPerPage))

    const paginatedProducts = computed(() => {
      const start = (currentPage.value - 1) * itemsPerPage
      const end = start + itemsPerPage
      return filteredProducts.value.slice(start, end)
    })

    const onPageChange = (event) => {
      currentPage.value = event.page + 1
      // Scroll to top of products grid
      document.querySelector('.products-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    // Reset page when filters change
    watch([debouncedSearchQuery, activeFilter], () => {
      currentPage.value = 1
    })

    // Price modal computed properties
    const cheapestCompetitorPrice = computed(() => {
      if (!priceModalProduct.value?.competitors?.length) return null
      const prices = priceModalProduct.value.competitors
        .filter(c => c.price && c.in_stock !== false)
        .map(c => c.price)
      return prices.length > 0 ? Math.min(...prices) : null
    })

    const calculatedMarginPrice = computed(() => {
      if (!cheapestCompetitorPrice.value || profitMargin.value == null) return null
      return Math.round(cheapestCompetitorPrice.value * (1 + profitMargin.value / 100))
    })

    const newPricePreview = computed(() => {
      switch (priceChangeMode.value) {
        case 'manual':
          return manualPrice.value
        case 'margin':
          return calculatedMarginPrice.value
        case 'match':
          return cheapestCompetitorPrice.value
        default:
          return null
      }
    })

    const priceDifference = computed(() => {
      if (!newPricePreview.value || !priceModalProduct.value?.our_price) return 0
      return newPricePreview.value - priceModalProduct.value.our_price
    })

    const priceDifferencePercent = computed(() => {
      if (!priceModalProduct.value?.our_price || priceDifference.value === 0) return '0%'
      const percent = (priceDifference.value / priceModalProduct.value.our_price) * 100
      return `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`
    })

    // Price modal methods
    const openPriceModal = (product) => {
      priceModalProduct.value = product
      priceChangeMode.value = 'margin'
      manualPrice.value = product.our_price
      profitMargin.value = -5
      priceModalVisible.value = true
    }

    const closePriceModal = () => {
      priceModalVisible.value = false
      priceModalProduct.value = null
    }

    const submitPriceChange = async () => {
      if (!newPricePreview.value || !priceModalProduct.value) return

      updatingPrice.value = true
      try {
        await Nova.request().put(`/nova-vendor/price-checker/products/${priceModalProduct.value.product_id}/price`, {
          price: newPricePreview.value
        })

        // Update local state
        const productIndex = comparisonData.value.findIndex(p => p.product_id === priceModalProduct.value.product_id)
        if (productIndex !== -1) {
          comparisonData.value[productIndex].our_price = newPricePreview.value
          // Clear cache for this product
          priceCache.delete(priceModalProduct.value.product_id)
          positionCache.delete(priceModalProduct.value.product_id)
        }

        closePriceModal()
      } catch (err) {
        console.error('Failed to update price:', err)
        alert('Failed to update price. Please try again.')
      } finally {
        updatingPrice.value = false
      }
    }

    const fetchProducts = async () => {
      try {
        const response = await Nova.request().get('/nova-vendor/price-checker/products')
        products.value = response.data.products || []
      } catch (err) {
        console.error('Failed to fetch products:', err)
      }
    }

    const fetchComparison = async () => {
      try {
        loading.value = true
        error.value = null
        clearCaches() // Clear memoization caches on refresh

        const response = await Nova.request().get('/nova-vendor/price-checker/comparison')

        if (response.data.error) {
          error.value = response.data.error
          comparisonData.value = []
          serverStatus.value = 'offline'
        } else {
          comparisonData.value = response.data.data || []
          serverStatus.value = 'online'
        }
      } catch (err) {
        console.error('Failed to fetch comparison:', err)
        error.value = 'Failed to connect to price server'
        comparisonData.value = []
        serverStatus.value = 'offline'
      } finally {
        loading.value = false
      }
    }

    const fetchChanges = async () => {
      try {
        const response = await Nova.request().get('/nova-vendor/price-checker/changes')
        recentChanges.value = response.data.changes || []
      } catch (err) {
        console.error('Failed to fetch changes:', err)
      }
    }

    const fetchJobs = async () => {
      try {
        loadingJobs.value = true
        const response = await Nova.request().get('/nova-vendor/price-checker/jobs')
        jobs.value = response.data.jobs || []
      } catch (err) {
        console.error('Failed to fetch jobs:', err)
      } finally {
        loadingJobs.value = false
      }
    }

    const clearFilters = () => {
      selectedProducts.value = []
      searchQuery.value = ''
      activeFilter.value = 'all'
    }

    const getCardClass = (product) => {
      const pos = getProductPosition(product)
      return {
        'card-cheapest': pos === 'cheapest',
        'card-competitive': pos === 'competitive',
        'card-expensive': pos === 'expensive',
        'card-no-competitors': pos === 'none'
      }
    }

    const refreshProduct = async (product) => {
      if (refreshingProducts.has(product.product_id)) return
      refreshingProducts.add(product.product_id)
      try {
        // Trigger refresh on the price server (queue all sources for this product)
        await Nova.request().post(`/nova-vendor/price-checker/products/${product.product_id}/refresh`)

        // Wait a moment for workers to potentially pick up the job
        await new Promise(r => setTimeout(r, 2000))

        // Fetch fresh data for just this product
        const response = await Nova.request().get('/nova-vendor/price-checker/comparison', {
          params: { product_id: product.product_id }
        })

        if (response.data.data && response.data.data.length > 0) {
          const freshProduct = response.data.data[0]
          // Update just this product in the list
          const productIndex = comparisonData.value.findIndex(p => p.product_id === product.product_id)
          if (productIndex !== -1) {
            // Merge fresh data while preserving order in the array
            // Update competitors and other fields, but keep existing our_price if fresh one is same
            const existingProduct = comparisonData.value[productIndex]
            comparisonData.value[productIndex] = {
              ...existingProduct,
              ...freshProduct,
              // Keep our_price from fresh data (it should be the source of truth from backend)
            }
            // Clear cache for this product to recalculate position
            priceCache.delete(product.product_id)
            positionCache.delete(product.product_id)
          }
        }
      } catch (err) {
        console.error('Failed to refresh product:', err)
      } finally {
        refreshingProducts.delete(product.product_id)
      }
    }

    const viewHistory = (product) => {
      // In future: open modal with price history chart
      console.log('View history for:', product.product_id)
    }

    const getProductUrl = (product) => {
      // Return the product URL on main backend
      return `resources/products/${product.product_id}`
    }

    // Memoization cache
    const priceCache = new Map()
    const positionCache = new Map()

    const clearCaches = () => {
      priceCache.clear()
      positionCache.clear()
    }

    const getSortedPricesWithOurs = (product) => {
      const cacheKey = product.product_id
      if (priceCache.has(cacheKey)) {
        return priceCache.get(cacheKey)
      }

      const prices = []

      // Add our price
      if (product.our_price) {
        prices.push({
          key: 'ours',
          isOurs: true,
          price: product.our_price,
          diff: 0
        })
      }

      // Add competitor prices
      if (product.competitors) {
        product.competitors.forEach(c => {
          if (c.price) {
            const diffAmount = product.our_price ? c.price - product.our_price : 0
            const diffPercent = product.our_price ? (diffAmount / product.our_price) * 100 : 0
            prices.push({
              key: c.source_id,
              isOurs: false,
              domain: getStoreName(c.domain),
              url: c.url,
              price: c.price,
              diff: diffPercent,
              diffAmount: diffAmount,
              in_stock: c.in_stock,
              checked_at: c.checked_at
            })
          }
        })
      }

      // Sort by price ascending
      const sorted = prices.sort((a, b) => a.price - b.price)
      priceCache.set(cacheKey, sorted)
      return sorted
    }

    const getOrdinalSuffix = (n) => {
      const s = ['th', 'st', 'nd', 'rd']
      const v = n % 100
      return s[(v - 20) % 10] || s[v] || s[0]
    }

    const getPricePosition = (product) => {
      const cacheKey = product.product_id
      if (positionCache.has(cacheKey)) {
        return positionCache.get(cacheKey)
      }

      const sorted = getSortedPricesWithOurs(product)
      const ourIndex = sorted.findIndex(p => p.isOurs)
      const total = sorted.length

      let result
      if (ourIndex === -1 || total <= 1) {
        result = { label: 'N/A', icon: 'minus', class: 'position-na', detail: 'No comparison data' }
      } else {
        const percent = (ourIndex / (total - 1)) * 100

        if (ourIndex === 0) {
          result = {
            label: 'Best Price!',
            icon: 'trophy',
            class: 'position-best',
            detail: `Cheapest of ${total} prices`
          }
        } else if (ourIndex === total - 1) {
          result = {
            label: 'Most Expensive',
            icon: 'up',
            class: 'position-worst',
            detail: `${total}${getOrdinalSuffix(total)} of ${total} prices`
          }
        } else if (percent <= 40) {
          result = {
            label: 'Competitive',
            icon: 'down',
            class: 'position-good',
            detail: `${ourIndex + 1}${getOrdinalSuffix(ourIndex + 1)} of ${total} prices`
          }
        } else {
          result = {
            label: 'Above Average',
            icon: 'up',
            class: 'position-bad',
            detail: `${ourIndex + 1}${getOrdinalSuffix(ourIndex + 1)} of ${total} prices`
          }
        }
      }

      positionCache.set(cacheKey, result)
      return result
    }

    const getStatusSeverity = (status) => {
      switch (status) {
        case 'completed': return 'success'
        case 'processing': return 'info'
        case 'pending': return 'warning'
        case 'failed': return 'danger'
        default: return 'secondary'
      }
    }

    const formatPrice = (price) => {
      if (price == null) return '-'
      return new Intl.NumberFormat('en-US').format(price)
    }

    const formatTime = (timestamp) => {
      if (!timestamp) return '-'
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60000)
      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      const diffHours = Math.floor(diffMins / 60)
      if (diffHours < 24) return `${diffHours}h ago`
      return date.toLocaleDateString()
    }

    const formatDiff = (oldPrice, newPrice) => {
      const diff = newPrice - oldPrice
      const percent = ((diff / oldPrice) * 100).toFixed(1)
      return `${diff > 0 ? '+' : ''}${percent}%`
    }

    const formatDiffPercent = (diff) => {
      return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`
    }

    // Watch tab changes to load data
    watch(activeTabIndex, (newIndex) => {
      if (newIndex === 2 && jobs.value.length === 0) {
        fetchJobs()
      }
    })

    onMounted(async () => {
      await fetchProducts()
      await Promise.all([fetchComparison(), fetchChanges()])

      // Auto-refresh every 5 minutes
      refreshInterval.value = setInterval(() => {
        fetchComparison()
        fetchChanges()
      }, 300000)
    })

    onUnmounted(() => {
      if (refreshInterval.value) {
        clearInterval(refreshInterval.value)
      }
    })

    return {
      products,
      selectedProducts,
      searchQuery,
      activeFilter,
      setFilter,
      productOptions,
      comparisonData,
      filteredProducts,
      paginatedProducts,
      currentPage,
      itemsPerPage,
      totalPages,
      onPageChange,
      recentChanges,
      jobs,
      loading,
      loadingJobs,
      error,
      activeTabIndex,
      totalSources,
      serverStatus,
      serverStatusText,
      refreshingProducts,
      positionCounts,
      // Price modal
      priceModalVisible,
      priceModalProduct,
      priceChangeMode,
      manualPrice,
      profitMargin,
      updatingPrice,
      cheapestCompetitorPrice,
      calculatedMarginPrice,
      newPricePreview,
      priceDifference,
      priceDifferencePercent,
      openPriceModal,
      closePriceModal,
      submitPriceChange,
      // Methods
      fetchComparison,
      fetchJobs,
      clearFilters,
      getCardClass,
      refreshProduct,
      viewHistory,
      getProductUrl,
      getSortedPricesWithOurs,
      getPricePosition,
      getStatusSeverity,
      formatPrice,
      formatTime,
      formatDiff,
      formatDiffPercent,
    }
  },
}
</script>

<style scoped>
.price-checker-dashboard {
  padding: 1.5rem;
  min-height: 100vh;
}

/* Main Content */
.main-content {
  background: var(--surface-card);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

/* Filters Panel */
.filters-panel {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--surface-border);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: flex-end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.filter-group.search-group {
  flex: 1;
  max-width: 280px;
  min-width: 180px;
}

.filter-group.position-filter,
.filter-group.competitor-filter {
  min-width: 160px;
}

.filter-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.search-input {
  width: 100%;
}

.position-select,
.competitor-select {
  min-width: 150px;
}

.filter-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

.filter-actions .p-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Filter Bar with Segmented Control */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.segment-control {
  display: inline-flex;
  background: var(--surface-ground);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.segment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  white-space: nowrap;
}

.segment:hover {
  color: var(--text-color);
  background: rgba(0, 0, 0, 0.04);
}

.segment.active {
  background: var(--surface-card);
  color: var(--text-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.segment-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.segment-dot.cheapest { background: #22c55e; }
.segment-dot.competitive { background: #3b82f6; }
.segment-dot.expensive { background: #ef4444; }
.segment-dot.nodata { background: #9ca3af; }

.segment-label {
  font-weight: 500;
}

.segment-count {
  font-weight: 600;
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  background: var(--surface-border);
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
}

.segment.active .segment-count {
  background: var(--primary-color);
  color: #fff;
}

.segment-cheapest.active .segment-count { background: #22c55e; }
.segment-competitive.active .segment-count { background: #3b82f6; }
.segment-expensive.active .segment-count { background: #ef4444; }
.segment-nodata.active .segment-count { background: #6b7280; }

/* Server status indicator */
.server-status {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-left: auto;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
}

.server-status .status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.server-status.online {
  background: rgba(22, 163, 74, 0.1);
  color: #166534;
}

.server-status.online .status-dot {
  background: #22c55e;
  box-shadow: 0 0 6px #22c55e;
}

.server-status.offline {
  background: rgba(220, 38, 38, 0.1);
  color: #991b1b;
}

.server-status.offline .status-dot {
  background: #ef4444;
}

.server-status.unknown {
  background: rgba(245, 158, 11, 0.1);
  color: #92400e;
}

.server-status.unknown .status-dot {
  background: #f59e0b;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Tab Header */
.tab-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tab-badge {
  margin-left: 0.25rem;
}

/* Fix PrimeVue TabView styling consistency */
:deep(.p-tabview) {
  background: transparent;
}

:deep(.p-tabview-nav) {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--surface-border);
  padding: 0 1rem;
}

:deep(.p-tabview-nav li) {
  margin-bottom: -1px;
}

:deep(.p-tabview-nav-link) {
  background: transparent !important;
  border: none !important;
  border-bottom: 2px solid transparent !important;
  border-radius: 0 !important;
  padding: 0.75rem 1rem !important;
  margin: 0 !important;
  transition: border-color 0.15s, color 0.15s;
}

:deep(.p-tabview-nav-link:not(.p-disabled):focus) {
  box-shadow: none !important;
}

:deep(.p-tabview-nav-link:hover) {
  border-bottom-color: var(--text-color-secondary) !important;
}

:deep(.p-tabview-selected .p-tabview-nav-link),
:deep(.p-highlight .p-tabview-nav-link),
:deep(.p-tabview-nav li.p-highlight .p-tabview-nav-link) {
  border-bottom-color: var(--primary-color) !important;
  color: var(--primary-color) !important;
}

:deep(.p-tabview-panels) {
  padding: 0;
  background: transparent;
}

/* States */
.loading-state,
.empty-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
  color: var(--text-color-secondary);
}

.error-state {
  color: #dc2626;
}

/* Products Grid */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
  gap: 1.25rem;
  padding: 1.25rem;
}

/* Pagination */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 1rem 1.25rem 1.5rem;
  border-top: 1px solid var(--surface-border);
}

.pagination-wrapper :deep(.p-paginator) {
  background: transparent;
  border: none;
  padding: 0;
}

/* Product Card */
.product-card {
  background: var(--surface-card);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  border: 2px solid transparent;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.product-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.12);
}

/* Card position variants with strong left border */
.product-card.card-cheapest {
  border-left: 4px solid #22c55e;
  background: linear-gradient(to right, rgba(34, 197, 94, 0.05), transparent 30%);
}

.product-card.card-competitive {
  border-left: 4px solid #3b82f6;
  background: linear-gradient(to right, rgba(59, 130, 246, 0.05), transparent 30%);
}

.product-card.card-expensive {
  border-left: 4px solid #ef4444;
  background: linear-gradient(to right, rgba(239, 68, 68, 0.05), transparent 30%);
}

.product-card.card-no-competitors {
  border-left: 4px solid #9ca3af;
  background: linear-gradient(to right, rgba(156, 163, 175, 0.05), transparent 30%);
}

/* Card Header */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--surface-border);
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 0.25rem 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-sku {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
  font-family: monospace;
}

.our-price-badge {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  margin-left: 0.75rem;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}

.our-price-label {
  font-size: 0.6rem;
  color: rgba(0,0,0,0.6);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.our-price-value {
  font-size: 1rem;
  font-weight: 700;
  color: #000;
  font-family: monospace;
}

/* Card Body */
.card-body {
  padding: 0;
}

/* Position Summary */
.position-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--surface-border);
}

.position-summary.position-best {
  background: linear-gradient(to right, rgba(34, 197, 94, 0.12), transparent);
}

.position-summary.position-good {
  background: linear-gradient(to right, rgba(59, 130, 246, 0.12), transparent);
}

.position-summary.position-bad {
  background: linear-gradient(to right, rgba(249, 115, 22, 0.12), transparent);
}

.position-summary.position-worst {
  background: linear-gradient(to right, rgba(239, 68, 68, 0.12), transparent);
}

.position-summary.position-na {
  background: var(--surface-ground);
}

.position-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.position-best .position-icon {
  background: #dcfce7;
  color: #16a34a;
}

.position-good .position-icon {
  background: #dbeafe;
  color: #2563eb;
}

.position-bad .position-icon {
  background: #ffedd5;
  color: #ea580c;
}

.position-worst .position-icon {
  background: #fee2e2;
  color: #dc2626;
}

.position-na .position-icon {
  background: var(--surface-border);
  color: var(--text-color-secondary);
}

.position-text {
  display: flex;
  flex-direction: column;
}

.position-label {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-color);
}

.position-detail {
  font-size: 0.7rem;
  color: var(--text-color-secondary);
}

/* No competitors state */
.no-competitors {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--text-color-secondary);
}

.no-competitors svg {
  opacity: 0.5;
}

.no-competitors span {
  font-size: 0.8rem;
}

/* Competitors List */
.competitors-list {
  padding: 0.5rem 0;
  max-height: 280px;
  overflow-y: auto;
}

.competitor-row {
  display: flex;
  align-items: center;
  padding: 0.5rem 1.25rem;
  gap: 0.75rem;
  transition: background-color 0.15s;
}

.competitor-row:hover {
  background: var(--surface-hover);
}

.competitor-row.is-ours {
  background: rgba(251, 191, 36, 0.15);
}

.competitor-row.is-cheapest {
  background: rgba(34, 197, 94, 0.08);
}

.competitor-row.is-expensive {
  background: rgba(239, 68, 68, 0.08);
}

.competitor-row.is-cheapest .competitor-rank {
  background: #22c55e;
  color: #fff;
}

.competitor-row.is-expensive .competitor-rank {
  background: #ef4444;
  color: #fff;
}

.competitor-rank {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--surface-ground);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-color-secondary);
  flex-shrink: 0;
}

.competitor-rank.rank-1 {
  background: #22c55e;
  color: #fff;
}

.competitor-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.competitor-name {
  font-size: 0.8rem;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.competitor-name.competitor-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  text-decoration: none;
  color: var(--text-color);
  transition: color 0.15s;
}

.competitor-name.competitor-link:hover {
  color: var(--primary-color);
  text-decoration: underline;
}

.competitor-name.competitor-link svg {
  opacity: 0.5;
  flex-shrink: 0;
}

.competitor-name.competitor-link:hover svg {
  opacity: 1;
}

.competitor-name.our-name {
  font-weight: 600;
  color: #d97706;
}

.competitor-time {
  font-size: 0.65rem;
  color: var(--text-color-secondary);
}

.competitor-price {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-shrink: 0;
}

.competitor-price .price-value {
  font-family: monospace;
  font-weight: 500;
  font-size: 0.85rem;
}

.competitor-price .price-ours {
  color: #d97706;
  font-weight: 600;
}

.diff-badge {
  font-size: 0.65rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  font-weight: 500;
}

.diff-badge.cheaper {
  background: #dcfce7;
  color: #166534;
}

.diff-badge.expensive {
  background: #fee2e2;
  color: #991b1b;
}

.diff-amount {
  font-size: 0.7rem;
  font-family: monospace;
  font-weight: 500;
}

.diff-amount.cheaper {
  color: #16a34a;
}

.diff-amount.expensive {
  color: #dc2626;
}

.oos-badge {
  font-size: 0.6rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: #fef3c7;
  color: #92400e;
  font-weight: 600;
}

/* Card Footer Actions */
.card-footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--surface-border);
  background: var(--surface-ground);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-color-secondary);
  cursor: pointer;
  transition: all 0.15s;
  text-decoration: none;
}

.action-btn:hover {
  background: var(--surface-hover);
  color: var(--text-color);
  border-color: var(--text-color-secondary);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn svg {
  flex-shrink: 0;
}

/* Changes List */
.changes-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
}

.change-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: 8px;
}

.change-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.change-icon.down {
  background: #dcfce7;
  color: #16a34a;
}

.change-icon.up {
  background: #fee2e2;
  color: #dc2626;
}

.change-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.change-product {
  font-weight: 500;
  color: var(--text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.change-store {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
}

.change-prices {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: monospace;
}

.old-price {
  color: var(--text-color-secondary);
  text-decoration: line-through;
}

.arrow {
  color: var(--text-color-secondary);
}

.new-price {
  font-weight: 600;
}

.new-price.decreased { color: #16a34a; }
.new-price.increased { color: #dc2626; }

.change-time {
  font-size: 0.75rem;
  color: var(--text-color-secondary);
  white-space: nowrap;
}

/* Jobs Table */
.jobs-table {
  font-size: 0.875rem;
}

.job-domain {
  font-weight: 500;
}

.job-product {
  color: var(--text-color-secondary);
  font-size: 0.8rem;
}

.job-price {
  font-family: monospace;
  font-weight: 500;
}

.no-price {
  color: var(--text-color-secondary);
}

.job-time {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
}

/* Action Button Primary */
.action-btn.primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: #fff;
  border-color: #2563eb;
}

.action-btn.primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  border-color: #1d4ed8;
}

/* Price Modal */
.price-modal-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.price-info-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.price-info-item {
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
}

.price-info-item.current {
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(245, 158, 11, 0.15) 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.price-info-item.cheapest {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.15) 100%);
  border: 1px solid rgba(22, 163, 74, 0.3);
}

.price-info-label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--text-color-secondary);
  margin-bottom: 0.25rem;
}

.price-info-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
  font-family: monospace;
}

.price-info-value.no-data {
  color: var(--text-color-secondary);
  font-size: 1rem;
}

.price-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.price-option {
  padding: 1rem;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  transition: all 0.15s;
}

.price-option:has(input:checked) {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.05);
}

.price-option.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  font-weight: 500;
}

.option-label input[type="radio"] {
  width: 18px;
  height: 18px;
  accent-color: #3b82f6;
}

.match-price {
  margin-left: auto;
  font-family: monospace;
  font-weight: 600;
  color: #16a34a;
}

.option-input {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--surface-border);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.price-input {
  flex: 1;
}

.input-suffix {
  font-size: 0.8rem;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.margin-input-field {
  width: 120px;
}

.calculated-price {
  font-family: monospace;
  font-weight: 600;
  color: #16a34a;
}

.new-price-preview {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--surface-ground);
  border-radius: 8px;
  border: 2px solid var(--surface-border);
}

.preview-label {
  font-weight: 500;
  color: var(--text-color-secondary);
}

.preview-value {
  font-size: 1.5rem;
  font-weight: 700;
  font-family: monospace;
  color: var(--text-color);
}

.preview-diff {
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.preview-diff.decrease {
  background: #dcfce7;
  color: #166534;
}

.preview-diff.increase {
  background: #fee2e2;
  color: #991b1b;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

/* Responsive */
@media (max-width: 768px) {
  .price-checker-dashboard {
    padding: 1rem;
  }

  .filter-row {
    flex-direction: column;
  }

  .filter-group {
    width: 100%;
    max-width: none !important;
  }

  .filter-group.search-group {
    max-width: none;
  }

  .filter-actions {
    width: 100%;
    margin-left: 0;
  }

  .filter-actions .p-button {
    flex: 1;
  }

  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }

  .segment-control {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .segment-control::-webkit-scrollbar {
    display: none;
  }

  .segment {
    padding: 6px 10px;
    font-size: 0.75rem;
  }

  .segment-label {
    display: none;
  }

  .segment-dot {
    width: 6px;
    height: 6px;
  }

  .server-status {
    align-self: flex-end;
  }

  .products-grid {
    grid-template-columns: 1fr;
    padding: 1rem;
    gap: 1rem;
  }

  .card-footer {
    flex-wrap: wrap;
  }

  .action-btn {
    flex: 1;
    justify-content: center;
  }

  .change-card {
    flex-wrap: wrap;
  }

  .change-prices {
    width: 100%;
    justify-content: center;
    margin-top: 0.5rem;
  }
}
</style>
