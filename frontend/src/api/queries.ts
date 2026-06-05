import { useQuery, useMutation } from '@tanstack/react-query'
import * as api from './client'
import type {
  ExecutiveSummary, RevenueTrend, CategoryPerf, TopPerformers, MarketShareItem,
  PriceElasticity, RevenueWaterfall, PromoROI, MixItem,
  AssortmentItem, SubcatTrend,
  ForecastAccuracy, ForecastData, DemandDecomp,
  InventoryHealth, ServiceLevels, ReplenishmentAlert,
  CustomerPL, TradeEffectiveness,
  PriceScenario, PromoScenario,
  Product, Customer,
} from '../types'

const Q = {
  execSummary:   ['exec', 'summary'],
  revTrend:      ['exec', 'revenue-trend'],
  catPerf:       ['exec', 'category-perf'],
  topPerformers: (n: number) => ['exec', 'top-performers', n],
  marketShare:   ['exec', 'market-share'],
  priceElast:    (cat?: string) => ['rgm', 'price-elasticity', cat],
  waterfall:     ['rgm', 'waterfall'],
  promoROI:      ['rgm', 'promo-roi'],
  mixAnalysis:   ['rgm', 'mix-analysis'],
  assortment:    ['cat', 'assortment'],
  subcatTrends:  ['cat', 'subcat-trends'],
  fcAccuracy:    ['fc', 'accuracy'],
  fcData:        (p?: string, c?: string) => ['fc', 'data', p, c],
  decomp:        (cat: string) => ['fc', 'decomp', cat],
  invHealth:     ['sc', 'inv-health'],
  serviceLevels: ['sc', 'service-levels'],
  replenishment: ['sc', 'replenishment'],
  customerPL:    ['com', 'customer-pl'],
  tradeEffect:   ['com', 'trade-effect'],
  products:      ['ref', 'products'],
  customers:     ['ref', 'customers'],
  categories:    ['ref', 'categories'],
} as const

export const useExecutiveSummary  = () => useQuery<ExecutiveSummary>({ queryKey: Q.execSummary,   queryFn: api.fetchExecutiveSummary })
export const useRevenueTrend      = () => useQuery<RevenueTrend[]>({ queryKey: Q.revTrend,        queryFn: api.fetchRevenueTrend })
export const useCategoryPerf      = () => useQuery<CategoryPerf[]>({ queryKey: Q.catPerf,         queryFn: api.fetchCategoryPerf })
export const useTopPerformers     = (n = 10) => useQuery<TopPerformers>({ queryKey: Q.topPerformers(n), queryFn: () => api.fetchTopPerformers(n) })
export const useMarketShare       = () => useQuery<MarketShareItem[]>({ queryKey: Q.marketShare,  queryFn: api.fetchMarketShare })
export const usePriceElasticity   = (cat?: string) => useQuery<PriceElasticity[]>({ queryKey: Q.priceElast(cat), queryFn: () => api.fetchPriceElasticity(cat) })
export const useWaterfall         = () => useQuery<RevenueWaterfall>({ queryKey: Q.waterfall,     queryFn: api.fetchWaterfall })
export const usePromoROI          = () => useQuery<PromoROI[]>({ queryKey: Q.promoROI,            queryFn: api.fetchPromoROI })
export const useMixAnalysis       = () => useQuery<MixItem[]>({ queryKey: Q.mixAnalysis,          queryFn: api.fetchMixAnalysis })
export const useAssortment        = () => useQuery<AssortmentItem[]>({ queryKey: Q.assortment,    queryFn: api.fetchAssortment })
export const useSubcatTrends      = () => useQuery<SubcatTrend[]>({ queryKey: Q.subcatTrends,     queryFn: api.fetchSubcatTrends })
export const useForecastAccuracy  = () => useQuery<ForecastAccuracy[]>({ queryKey: Q.fcAccuracy,  queryFn: api.fetchForecastAccuracy })
export const useForecastData      = (p?: string, c?: string) => useQuery<ForecastData>({ queryKey: Q.fcData(p, c), queryFn: () => api.fetchForecastData(p, c) })
export const useDecomposition     = (cat: string) => useQuery<DemandDecomp>({ queryKey: Q.decomp(cat), queryFn: () => api.fetchDecomposition(cat) })
export const useInventoryHealth   = () => useQuery<InventoryHealth[]>({ queryKey: Q.invHealth,    queryFn: api.fetchInventoryHealth })
export const useServiceLevels     = () => useQuery<ServiceLevels>({ queryKey: Q.serviceLevels,    queryFn: api.fetchServiceLevels })
export const useReplenishment     = () => useQuery<ReplenishmentAlert[]>({ queryKey: Q.replenishment, queryFn: api.fetchReplenishment })
export const useCustomerPL        = () => useQuery<CustomerPL[]>({ queryKey: Q.customerPL,        queryFn: api.fetchCustomerPL })
export const useTradeEffectiveness= () => useQuery<TradeEffectiveness>({ queryKey: Q.tradeEffect, queryFn: api.fetchTradeEffectiveness })
export const useProducts          = () => useQuery<Product[]>({ queryKey: Q.products,             queryFn: api.fetchProducts })
export const useCustomers         = () => useQuery<Customer[]>({ queryKey: Q.customers,           queryFn: api.fetchCustomers })
export const useCategories        = () => useQuery<string[]>({ queryKey: Q.categories,            queryFn: api.fetchCategories })
export const usePriceSimulate     = () => useMutation<PriceScenario, Error, { product_id: string; price_change_pct: number; elasticity_override?: number }>({
  mutationFn: ({ product_id, price_change_pct, elasticity_override }) => api.postPriceSimulate(product_id, price_change_pct, elasticity_override) as Promise<PriceScenario>,
})
export const usePromoSimulate     = () => useMutation<PromoScenario, Error, { product_id: string; promo_type: string; num_events: number; discount_pct: number }>({
  mutationFn: (p) => api.postPromoSimulate(p.product_id, p.promo_type, p.num_events, p.discount_pct) as Promise<PromoScenario>,
})
