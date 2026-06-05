import axios from 'axios'

const BASE = '/api/v1'

export const api = axios.create({
  baseURL: BASE,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    console.error('[API]', err.config?.url, err.message)
    return Promise.reject(err)
  },
)

// ── helpers ──────────────────────────────────────────────────────────────────
const get = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<T>(url, { params }).then((r) => r.data)

const post = <T>(url: string, params?: Record<string, unknown>) =>
  api.post<T>(url, null, { params }).then((r) => r.data)

// ── Executive ─────────────────────────────────────────────────────────────────
export const fetchExecutiveSummary  = () => get('/executive/summary')
export const fetchRevenueTrend      = () => get('/executive/revenue-trend')
export const fetchCategoryPerf      = () => get('/executive/category-performance')
export const fetchTopPerformers     = (n = 10) => get('/executive/top-performers', { n })
export const fetchMarketShare       = () => get('/executive/market-share')

// ── RGM ────────────────────────────────────────────────────────────────────
export const fetchPriceElasticity   = (category?: string) => get('/rgm/price-elasticity', category ? { category } : undefined)
export const fetchWaterfall         = () => get('/rgm/revenue-waterfall')
export const fetchPromoROI          = () => get('/rgm/promo-roi')
export const fetchMixAnalysis       = () => get('/rgm/mix-analysis')
export const postPriceSimulate      = (product_id: string, price_change_pct: number, elasticity_override?: number) =>
  post('/rgm/simulate-price', { product_id, price_change_pct, ...(elasticity_override != null ? { elasticity_override } : {}) })
export const postPromoSimulate      = (product_id: string, promo_type: string, num_events: number, discount_pct: number) =>
  post('/rgm/simulate-promo', { product_id, promo_type, num_events, discount_pct })

// ── Category ─────────────────────────────────────────────────────────────────
export const fetchAssortment        = () => get('/category/assortment')
export const fetchSubcatTrends      = () => get('/category/subcategory-trends')

// ── Forecasting ───────────────────────────────────────────────────────────────
export const fetchForecastAccuracy  = () => get('/forecasting/accuracy')
export const fetchForecastData      = (product_id?: string, customer_id?: string) =>
  get('/forecasting/sales-vs-forecast', { ...(product_id ? { product_id } : {}), ...(customer_id ? { customer_id } : {}) })
export const fetchDecomposition     = (category = 'Beverages') => get('/forecasting/decomposition', { category })

// ── Supply Chain ──────────────────────────────────────────────────────────────
export const fetchInventoryHealth   = () => get('/supply-chain/inventory-health')
export const fetchServiceLevels     = () => get('/supply-chain/service-levels')
export const fetchReplenishment     = () => get('/supply-chain/replenishment-alerts')

// ── Commercial ────────────────────────────────────────────────────────────────
export const fetchCustomerPL        = () => get('/commercial/customer-pl')
export const fetchTradeEffectiveness= () => get('/commercial/trade-effectiveness')

// ── Reference ─────────────────────────────────────────────────────────────────
export const fetchProducts          = () => get('/data/products')
export const fetchCustomers         = () => get('/data/customers')
export const fetchCategories        = () => get('/data/categories')

// ── Health ────────────────────────────────────────────────────────────────────
export const checkHealth            = () => axios.get('/health', { timeout: 5_000 }).then(() => true).catch(() => false)
