import { api } from './client'

// All RMM endpoints live under /api/v1/rmm (api baseURL already includes /api/v1)

// ── Feature registry ──────────────────────────────────────────────────────────
export const fetchRmmFeatures = () => api.get('/rmm/features').then(r => r.data)

// ── 3-C joint optimization ────────────────────────────────────────────────────
export interface ThreeCInput {
  product_id?: string
  customer_id?: string
  company_unit_price: number
  company_unit_cost: number
  company_target_margin: number
  retail_shelf_price: number
  retailer_margin_floor: number
  wtp_median: number
  wtp_p90: number
}
export const postThreeC = (body: ThreeCInput) => api.post('/rmm/three-c/score', body).then(r => r.data)

// ── Elasticity & cannibalization ──────────────────────────────────────────────
export const postContextMatrix = (product_id: string) =>
  api.post(`/rmm/elasticity/context-matrix?product_id=${product_id}`).then(r => r.data)
export const postCannibalization = (product_id: string, price_change_pct = 5) =>
  api.post(`/rmm/cannibalization?product_id=${product_id}&price_change_pct=${price_change_pct}`).then(r => r.data)

// ── Maturity / governance ─────────────────────────────────────────────────────
export const fetchMaturity = () => api.get('/rmm/maturity').then(r => r.data)
export const fetchSkuGovernor = (margin_floor_pct = 30) =>
  api.get(`/rmm/sku-governor?margin_floor_pct=${margin_floor_pct}`).then(r => r.data)
export const fetchCommodityExposure = (shock = 10) =>
  api.get(`/rmm/commodity/exposure?index_shock_pct=${shock}`).then(r => r.data)
export const postCostToServe = (body: any) => api.post('/rmm/cost-to-serve', body).then(r => r.data)
export const postComplexity = (body: any) => api.post('/rmm/complexity-friction', body).then(r => r.data)
export const postPriceSmoothing = (proposed_changes: any[]) =>
  api.post('/rmm/price-smoothing/check', { proposed_changes }).then(r => r.data)
export const postGuardrails = (body: any) => api.post('/rmm/guardrails/evaluate', body).then(r => r.data)

// ── TPM / promotions ──────────────────────────────────────────────────────────
export const postPromoSim = (body: any) => api.post('/rmm/tpm/simulate', body).then(r => r.data)
export const postPostEventROI = (product_id?: string) =>
  api.post(`/rmm/tpm/post-event-roi${product_id ? `?product_id=${product_id}` : ''}`).then(r => r.data)
export const fetchCalendar = () => api.get('/rmm/tpm/calendar').then(r => r.data)
export const createCalendarEvent = (body: any) => api.post('/rmm/tpm/calendar', body).then(r => r.data)
export const deleteCalendarEvent = (id: number) => api.delete(`/rmm/tpm/calendar/${id}`).then(r => r.data)

// ── G2N / trade terms ─────────────────────────────────────────────────────────
export const postG2NApprove = (body: any) => api.post('/rmm/g2n/approve', body).then(r => r.data)
export const fetchTradeFund = (fiscal_year = 2024) =>
  api.get(`/rmm/g2n/trade-fund?fiscal_year=${fiscal_year}`).then(r => r.data)
export const allocateFund = (body: any) => api.post('/rmm/g2n/trade-fund/allocate', body).then(r => r.data)
export const commitFund = (body: any) => api.post('/rmm/g2n/trade-fund/commit', body).then(r => r.data)
export const reconcileClaim = (body: any) => api.post('/rmm/g2n/claims/reconcile', body).then(r => r.data)
