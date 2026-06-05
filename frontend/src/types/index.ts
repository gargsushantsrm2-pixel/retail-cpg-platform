// ── Executive ──────────────────────────────────────────────────────────────
export interface KpiMetric {
  value: number
  vs_py_pct: number
  label: string
  unit: string
}
export interface ExecutiveSummary {
  revenue:       KpiMetric
  volume:        KpiMetric
  gross_profit:  KpiMetric
  gross_margin:  KpiMetric
  market_share:  KpiMetric
  promo_pct:     KpiMetric
}
export interface RevenueTrend {
  month:         string
  year:          number
  revenue:       number
  revenue_py:    number
  volume:        number
  gross_profit:  number
  rev_vs_py_pct: number
}
export interface CategoryPerf {
  category:        string
  revenue:         number
  volume:          number
  gross_profit:    number
  gm_pct:          number
  rev_growth_pct:  number
  rev_share_pct:   number
  rev_py:          number
  vol_py:          number
}
export interface TopPerformers {
  top_brands:       BrandPerf[]
  top_skus:         SkuPerf[]
  bottom_skus:      SkuPerf[]
  customer_ranking: CustomerPerf[]
}
export interface BrandPerf  { brand: string; revenue: number; volume: number }
export interface SkuPerf    { product_id: string; sku_name: string; brand: string; revenue: number; volume: number; gm_pct: number }
export interface CustomerPerf { customer_id: string; customer_name: string; channel: string; revenue: number; volume: number }

// ── RGM ───────────────────────────────────────────────────────────────────
export interface PriceElasticity {
  product_id:         string
  sku_name:           string
  brand:              string
  category:           string
  elasticity:         number
  r_squared:          number
  avg_price:          number
  avg_weekly_volume:  number
  annual_revenue:     number
}
export interface WaterfallItem { label: string; value: number; type: 'total' | 'relative' }
export interface RevenueWaterfall {
  py_revenue:    number
  cy_revenue:    number
  total_change:  number
  volume_effect: number
  price_effect:  number
  mix_effect:    number
  waterfall:     WaterfallItem[]
}
export interface PromoROI {
  promo_type:          string
  num_events:          number
  avg_lift_pct:        number
  incremental_revenue: number
  trade_spend:         number
  roi_pct:             number
  incremental_volume:  number
}
export interface MixItem {
  brand:        string
  category:     string
  revenue:      number
  avg_price:    number
  vol_growth:   number
  rev_growth:   number
  price_change: number
  rev_share:    number
}

// ── Category ──────────────────────────────────────────────────────────────
export interface AssortmentItem {
  product_id:       string
  sku_name:         string
  brand:            string
  category:         string
  subcategory:      string
  revenue:          number
  volume:           number
  gm_pct:           number
  promo_freq_pct:   number
  num_customers:    number
  velocity_index:   number
  pareto_flag:      boolean
  rev_share:        number
  cumulative_rev_share: number
}
export interface SubcatTrend {
  category:      string
  subcategory:   string
  year:          number
  quarter:       number
  quarter_label: string
  revenue:       number
  volume:        number
}
export interface MarketShareItem {
  category:     string
  brand:        string
  month:        string
  volume_share: number
  value_share:  number
}

// ── Forecasting ───────────────────────────────────────────────────────────
export interface ForecastAccuracy {
  brand:             string
  category:          string
  mape:              number
  wmape:             number
  forecast_accuracy: number
  bias_pct:          number
  total_volume:      number
}
export interface ForecastData {
  actuals:          { week_date: string; actual_volume: number }[]
  fitted:           { week_date: string; forecast_volume: number }[]
  forecast_forward: { week_date: string; forecast_volume: number; lower_bound: number; upper_bound: number }[]
}
export interface DemandDecomp {
  dates:     string[]
  actual:    number[]
  trend:     number[]
  seasonal:  number[]
  irregular: number[]
}

// ── Supply Chain ──────────────────────────────────────────────────────────
export interface InventoryHealth {
  product_id:       string
  sku_name:         string
  brand:            string
  category:         string
  avg_woc:          number
  total_on_hand:    number
  total_in_transit: number
  oos_rate_pct:     number
  risk_flag:        'Critical' | 'Low' | 'Healthy'
}
export interface ServiceLevels {
  monthly_trend: { month: string; year: number; fill_rate_pct: number; otif_pct: number; avg_woc: number }[]
  by_category:   { category: string; year: number; avg_woc: number; fill_rate: number }[]
}
export interface ReplenishmentAlert {
  product_id:     string
  sku_name:       string
  warehouse:      string
  weeks_of_cover: number
  urgency:        'CRITICAL' | 'HIGH' | 'MEDIUM'
  suggested_order:number
}

// ── Commercial ────────────────────────────────────────────────────────────
export interface CustomerPL {
  customer_id:             string
  customer_name:           string
  channel:                 string
  tier:                    string
  gross_revenue:           number
  trade_spend:             number
  net_revenue:             number
  gross_profit:            number
  gross_margin_pct:        number
  trade_spend_pct:         number
  contribution_margin_pct: number
  customer_contribution:   number
  sga_allocated:           number
  promo_freq_pct:          number
}
export interface TradeEffectiveness {
  by_customer: { customer_name: string; trade_spend: number; incremental_rev: number; roi: number; num_events: number }[]
  by_type:     { promo_type: string; trade_spend: number; incremental_rev: number; roi: number; avg_lift: number; events: number }[]
}

// ── Scenario ──────────────────────────────────────────────────────────────
export interface PriceScenario {
  product_id:     string
  sku_name:       string
  price_change_pct: number
  elasticity_used:  number
  base:    ScenarioMetrics
  scenario:ScenarioMetrics
  delta:   ScenarioDelta
}
export interface ScenarioMetrics { price: number; volume: number; revenue: number; gross_profit: number; gm_pct: number }
export interface ScenarioDelta   { volume: number; revenue: number; gross_profit: number; volume_pct: number; revenue_pct: number; gp_pct: number }
export interface PromoScenario {
  sku_name:            string
  promo_type:          string
  avg_lift_pct:        number
  incremental_revenue: number
  trade_spend:         number
  roi_pct:             number
  total_promo_volume:  number
  total_promo_revenue: number
}

// ── Reference ─────────────────────────────────────────────────────────────
export interface Product  { product_id: string; sku_name: string; brand: string; category: string; subcategory: string; base_price: number }
export interface Customer { customer_id: string; customer_name: string; channel: string; tier: string }
