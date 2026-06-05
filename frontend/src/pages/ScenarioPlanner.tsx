import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, LineChart, Line, ReferenceLine, Legend,
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { Spinner } from '../components/ui/Spinner'
import { useProducts, usePriceSimulate, usePromoSimulate, usePriceElasticity } from '../api/queries'
import { fmtCurrency, fmtVolume } from '../lib/utils'
import { CHART_STYLE, tooltipStyle, PALETTE } from '../lib/chartTheme'
import toast from 'react-hot-toast'

const PROMO_TYPES = ['TPR', 'Display', 'Feature', 'Display+Feature', 'Display+Feature+TPR']
const LIFT_REF: Record<string, string> = {
  TPR: '15–25%', Display: '28–42%', Feature: '22–35%',
  'Display+Feature': '50–80%', 'Display+Feature+TPR': '65–100%',
}

const TABS = [
  { id: 'price',     label: 'Price Scenario' },
  { id: 'promo',     label: 'Promo Scenario' },
  { id: 'portfolio', label: 'Portfolio Sensitivity' },
]

export default function ScenarioPlanner() {
  const { data: products } = useProducts()
  const priceMut  = usePriceSimulate()
  const promoMut  = usePromoSimulate()

  // Price scenario state
  const [priceSelProd, setPriceSelProd] = useState('')
  const [priceChange,  setPriceChange]  = useState(5)
  const [overrideElast, setOverrideElast] = useState(false)
  const [customElast, setCustomElast]   = useState(-2.5)
  const [priceResult, setPriceResult]   = useState<any>(null)

  // Promo scenario state
  const [promoSelProd,   setPromoSelProd]  = useState('')
  const [promoType,      setPromoType]     = useState('Display+Feature')
  const [numEvents,      setNumEvents]     = useState(8)
  const [discountPct,    setDiscountPct]   = useState(15)
  const [promoResult,    setPromoResult]   = useState<any>(null)

  const { data: elast } = usePriceElasticity()

  const runPrice = async () => {
    if (!priceSelProd) { toast.error('Select a product'); return }
    const res = await priceMut.mutateAsync({
      product_id: priceSelProd,
      price_change_pct: priceChange,
      elasticity_override: overrideElast ? customElast : undefined,
    })
    setPriceResult(res)
    toast.success('Simulation complete')
  }

  const runPromo = async () => {
    if (!promoSelProd) { toast.error('Select a product'); return }
    const res = await promoMut.mutateAsync({ product_id: promoSelProd, promo_type: promoType, num_events: numEvents, discount_pct: discountPct })
    setPromoResult(res)
    toast.success('Promo simulation complete')
  }

  // Portfolio sensitivity heatmap data
  const priceChanges = [-15, -10, -5, 0, 5, 10, 15]
  const top20 = (elast ?? []).slice(0, 20)

  return (
    <div className="animate-slide-in">
      <PageHeader title="Scenario Planner" subtitle="Price & Promo Simulation · Portfolio Sensitivity · What-If Analysis" />

      <Tabs tabs={TABS}>
        {(active) => (
          <>
            {/* ── Price Scenario ───────────────────────────────────────────── */}
            {active === 'price' && (
              <div className="grid xl:grid-cols-4 gap-4">
                {/* Controls */}
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-semibold">Controls</h3>

                  <div>
                    <label className="label-xs block mb-1.5">Product</label>
                    <select value={priceSelProd} onChange={e => setPriceSelProd(e.target.value)}
                      className="w-full text-xs bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent-blue">
                      <option value="">— Select —</option>
                      {(products ?? []).map(p => <option key={p.product_id} value={p.product_id}>{p.sku_name.slice(0, 45)}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="label-xs block mb-1.5">Price Change: {priceChange > 0 ? '+' : ''}{priceChange}%</label>
                    <input type="range" min={-20} max={20} step={0.5} value={priceChange}
                      onChange={e => setPriceChange(+e.target.value)}
                      className="w-full accent-accent-blue" />
                    <div className="flex justify-between text-xs text-text-muted mt-1"><span>-20%</span><span>+20%</span></div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                      <input type="checkbox" checked={overrideElast} onChange={e => setOverrideElast(e.target.checked)}
                        className="accent-accent-blue" />
                      Override Elasticity
                    </label>
                    {overrideElast && (
                      <div className="mt-2">
                        <label className="label-xs block mb-1">Elasticity: {customElast.toFixed(1)}</label>
                        <input type="range" min={-5} max={-0.5} step={0.1} value={customElast}
                          onChange={e => setCustomElast(+e.target.value)}
                          className="w-full accent-accent-blue" />
                      </div>
                    )}
                  </div>

                  <button onClick={runPrice} disabled={priceMut.isPending || !priceSelProd}
                    className="btn-primary w-full disabled:opacity-50">
                    {priceMut.isPending ? '⏳ Running…' : '▶ Run Simulation'}
                  </button>
                </div>

                {/* Results */}
                <div className="xl:col-span-3 space-y-4">
                  {priceResult && (
                    <>
                      {/* Impact cards */}
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Revenue Impact',   value: fmtCurrency(priceResult.delta.revenue),      delta: priceResult.delta.revenue_pct,    color: priceResult.delta.revenue >= 0 ? '#10B981' : '#EF4444' },
                          { label: 'Volume Impact',    value: fmtVolume(priceResult.delta.volume),         delta: priceResult.delta.volume_pct,     color: priceResult.delta.volume >= 0 ? '#10B981' : '#EF4444' },
                          { label: 'Gross Profit Δ',   value: fmtCurrency(priceResult.delta.gross_profit), delta: priceResult.delta.gp_pct,         color: priceResult.delta.gross_profit >= 0 ? '#10B981' : '#EF4444' },
                          { label: 'New GM%',          value: `${priceResult.scenario.gm_pct.toFixed(1)}%`, delta: priceResult.scenario.gm_pct - priceResult.base.gm_pct, color: '#3B82F6' },
                        ].map(({ label, value, delta, color }) => (
                          <div key={label} className="card-elevated p-3 text-center" style={{ borderTop: `3px solid ${color}` }}>
                            <p className="label-xs mb-1">{label}</p>
                            <p className="text-lg font-bold" style={{ color }}>{value}</p>
                            <p className="text-xs mt-0.5" style={{ color }}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid xl:grid-cols-2 gap-4">
                        {/* Base vs Scenario */}
                        <div className="card p-5">
                          <h3 className="text-sm font-semibold mb-3">Base vs Scenario</h3>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                              data={[
                                { metric: 'Revenue',      base: priceResult.base.revenue,      scenario: priceResult.scenario.revenue },
                                { metric: 'Gross Profit', base: priceResult.base.gross_profit,  scenario: priceResult.scenario.gross_profit },
                              ]}
                              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                              <XAxis dataKey="metric" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                              <YAxis tickFormatter={v => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [fmtCurrency(v), name]} />
                              <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                              <Bar name="Base"     dataKey="base"     fill="#475569" opacity={0.7} radius={[3, 3, 0, 0]} />
                              <Bar name="Scenario" dataKey="scenario" fill="#3B82F6" opacity={0.85} radius={[3, 3, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Sensitivity curve */}
                        <div className="card p-5">
                          <h3 className="text-sm font-semibold mb-3">Revenue Sensitivity Curve</h3>
                          {(() => {
                            const e = priceResult.elasticity_used ?? -2.5
                            const curve = Array.from({ length: 41 }, (_, i) => {
                              const pc = -20 + i
                              const vc = e * pc / 100
                              const rc = ((1 + pc / 100) * (1 + vc) - 1) * 100
                              return { pc, rc }
                            })
                            return (
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={curve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                  <CartesianGrid {...CHART_STYLE.grid} />
                                  <XAxis dataKey="pc" tickFormatter={v => `${v}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                                  <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Rev Impact']}
                                    labelFormatter={v => `Price Δ: ${v}%`} />
                                  <ReferenceLine y={0} stroke="#2D3460" />
                                  <ReferenceLine x={priceChange} stroke="#F59E0B" strokeDasharray="4 2"
                                    label={{ value: `${priceChange > 0 ? '+' : ''}${priceChange}%`, fill: '#F59E0B', fontSize: 10 }} />
                                  <Line type="monotone" dataKey="rc" stroke="#3B82F6" strokeWidth={2.5} dot={false} name="Rev Impact %" />
                                </LineChart>
                              </ResponsiveContainer>
                            )
                          })()}
                        </div>
                      </div>

                      {/* Comparison table */}
                      <div className="card p-5">
                        <h3 className="text-sm font-semibold mb-3">{priceResult.sku_name}</h3>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border text-text-muted text-xs uppercase tracking-wider">
                              <th className="pb-2 text-left font-medium">Metric</th>
                              <th className="pb-2 text-right font-medium">Base</th>
                              <th className="pb-2 text-right font-medium">Scenario</th>
                              <th className="pb-2 text-right font-medium">Δ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { m: 'Price', b: `$${priceResult.base.price.toFixed(2)}`, s: `$${priceResult.scenario.price.toFixed(2)}`, d: `${priceChange > 0 ? '+' : ''}${priceChange}%` },
                              { m: 'Volume (cs)', b: fmtVolume(priceResult.base.volume), s: fmtVolume(priceResult.scenario.volume), d: `${priceResult.delta.volume_pct > 0 ? '+' : ''}${priceResult.delta.volume_pct.toFixed(1)}%` },
                              { m: 'Revenue', b: fmtCurrency(priceResult.base.revenue), s: fmtCurrency(priceResult.scenario.revenue), d: `${priceResult.delta.revenue_pct > 0 ? '+' : ''}${priceResult.delta.revenue_pct.toFixed(1)}%` },
                              { m: 'Gross Profit', b: fmtCurrency(priceResult.base.gross_profit), s: fmtCurrency(priceResult.scenario.gross_profit), d: `${priceResult.delta.gp_pct > 0 ? '+' : ''}${priceResult.delta.gp_pct.toFixed(1)}%` },
                              { m: 'GM%', b: `${priceResult.base.gm_pct.toFixed(1)}%`, s: `${priceResult.scenario.gm_pct.toFixed(1)}%`, d: `${(priceResult.scenario.gm_pct - priceResult.base.gm_pct) > 0 ? '+' : ''}${(priceResult.scenario.gm_pct - priceResult.base.gm_pct).toFixed(1)}pp` },
                            ].map(({ m, b, s, d }) => (
                              <tr key={m} className="border-b border-border/50">
                                <td className="py-2 text-text-secondary">{m}</td>
                                <td className="py-2 text-right text-text-muted">{b}</td>
                                <td className="py-2 text-right text-accent-blue font-medium">{s}</td>
                                <td className="py-2 text-right text-xs font-semibold"
                                  style={{ color: d.startsWith('-') ? '#EF4444' : '#10B981' }}>{d}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {!priceResult && (
                    <div className="card p-10 text-center text-text-muted">
                      <p className="text-4xl mb-3">🎯</p>
                      <p>Select a product and run the simulation to see results.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Promo Scenario ───────────────────────────────────────────── */}
            {active === 'promo' && (
              <div className="grid xl:grid-cols-4 gap-4">
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-semibold">Controls</h3>
                  <div>
                    <label className="label-xs block mb-1.5">Product</label>
                    <select value={promoSelProd} onChange={e => setPromoSelProd(e.target.value)}
                      className="w-full text-xs bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent-blue">
                      <option value="">— Select —</option>
                      {(products ?? []).map(p => <option key={p.product_id} value={p.product_id}>{p.sku_name.slice(0, 45)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-xs block mb-1.5">Promo Type</label>
                    <select value={promoType} onChange={e => setPromoType(e.target.value)}
                      className="w-full text-xs bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent-blue">
                      {PROMO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-xs block mb-1.5">Events per Year: {numEvents}</label>
                    <input type="range" min={1} max={24} value={numEvents} onChange={e => setNumEvents(+e.target.value)} className="w-full accent-accent-blue" />
                  </div>
                  <div>
                    <label className="label-xs block mb-1.5">Discount: {discountPct}%</label>
                    <input type="range" min={5} max={30} step={0.5} value={discountPct} onChange={e => setDiscountPct(+e.target.value)} className="w-full accent-accent-blue" />
                  </div>
                  <div className="p-3 bg-bg-elevated rounded-lg border border-border">
                    <p className="label-xs mb-1">Expected Lift Range</p>
                    <p className="text-xl font-bold text-accent-amber">{LIFT_REF[promoType]}</p>
                    <p className="text-xs text-text-muted mt-0.5">{promoType}</p>
                  </div>
                  <button onClick={runPromo} disabled={promoMut.isPending || !promoSelProd}
                    className="btn-primary w-full disabled:opacity-50">
                    {promoMut.isPending ? '⏳ Running…' : '▶ Run Simulation'}
                  </button>
                </div>

                <div className="xl:col-span-3 space-y-4">
                  {promoResult ? (
                    <>
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { label: 'Promo ROI', value: `${promoResult.roi_pct > 0 ? '+' : ''}${promoResult.roi_pct.toFixed(1)}%`, color: promoResult.roi_pct > 0 ? '#10B981' : '#EF4444' },
                          { label: 'Incremental Rev', value: fmtCurrency(promoResult.incremental_revenue), color: '#10B981' },
                          { label: 'Trade Spend', value: fmtCurrency(promoResult.trade_spend), color: '#EF4444' },
                          { label: 'Volume Lift', value: `${promoResult.avg_lift_pct.toFixed(0)}%`, color: '#3B82F6' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="card-elevated p-3 text-center" style={{ borderTop: `3px solid ${color}` }}>
                            <p className="label-xs mb-1">{label}</p>
                            <p className="text-xl font-bold" style={{ color }}>{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid xl:grid-cols-2 gap-4">
                        {/* P&L waterfall */}
                        <div className="card p-5">
                          <h3 className="text-sm font-semibold mb-3">Promo P&L</h3>
                          <ResponsiveContainer width="100%" height={220}>
                            <BarChart
                              data={[
                                { name: 'Incr. Revenue', value: promoResult.incremental_revenue },
                                { name: 'Trade Spend',   value: -promoResult.trade_spend },
                                { name: 'Net Value',     value: promoResult.incremental_revenue - promoResult.trade_spend },
                              ]}
                              margin={{ top: 15, right: 15, left: 0, bottom: 0 }}
                            >
                              <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                              <XAxis dataKey="name" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                              <YAxis tickFormatter={v => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtCurrency(v), 'Value']} />
                              <Bar dataKey="value" radius={[3, 3, 0, 0]}
                                label={{ position: 'top', fill: '#94A3B8', fontSize: 10, formatter: (v: number) => fmtCurrency(v) }}>
                                {[1, -1, 1].map((s, i) => (
                                  <Cell key={i} fill={s > 0 ? '#10B981' : '#EF4444'} opacity={0.85} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* ROI vs events */}
                        <div className="card p-5">
                          <h3 className="text-sm font-semibold mb-3">ROI Sensitivity vs Events</h3>
                          {(() => {
                            const baseROI = promoResult.roi_pct
                            const curve = Array.from({ length: 24 }, (_, i) => ({
                              events: i + 1,
                              roi: baseROI, // simplified: ROI is invariant to count
                            }))
                            return (
                              <ResponsiveContainer width="100%" height={220}>
                                <LineChart data={curve} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                  <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                                  <XAxis dataKey="events" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} label={{ value: 'Events/Year', fill: '#94A3B8', fontSize: 10, dy: 10 }} />
                                  <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, 'ROI']} />
                                  <ReferenceLine y={0} stroke="#2D3460" />
                                  <ReferenceLine x={numEvents} stroke="#F59E0B" strokeDasharray="3 3"
                                    label={{ value: `Current: ${numEvents}`, fill: '#F59E0B', fontSize: 10 }} />
                                  <Line type="monotone" dataKey="roi" stroke={baseROI > 0 ? '#10B981' : '#EF4444'} strokeWidth={2.5} dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            )
                          })()}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="card p-10 text-center text-text-muted">
                      <p className="text-4xl mb-3">🏷️</p>
                      <p>Select a product and run the promo simulation to see results.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Portfolio Sensitivity ────────────────────────────────────── */}
            {active === 'portfolio' && (
              <div className="space-y-4">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Revenue Impact Matrix — Top 20 SKUs (Heatmap)</h3>
                  {top20.length > 0 ? (
                    <div className="overflow-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr>
                            <th className="text-left py-2 px-3 text-text-muted font-medium w-56">SKU</th>
                            <th className="text-center py-2 px-2 text-text-muted font-medium">Elasticity</th>
                            {priceChanges.map(pc => (
                              <th key={pc} className="text-center py-2 px-2 text-text-muted font-medium">
                                {pc > 0 ? '+' : ''}{pc}%
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {top20.map((sku) => (
                            <tr key={sku.product_id} className="border-t border-border/40">
                              <td className="py-1.5 px-3 text-text-secondary truncate max-w-[220px]">{sku.sku_name.slice(0, 35)}</td>
                              <td className="py-1.5 px-2 text-center font-medium"
                                style={{ color: sku.elasticity > -2 ? '#10B981' : sku.elasticity > -3 ? '#F59E0B' : '#EF4444' }}>
                                {sku.elasticity.toFixed(2)}
                              </td>
                              {priceChanges.map(pc => {
                                const volChg  = sku.elasticity * pc / 100
                                const revChg  = ((1 + pc / 100) * (1 + volChg) - 1) * 100
                                const absChg  = Math.abs(revChg)
                                const opacity = Math.min(absChg / 15, 1) * 0.7 + 0.1
                                const bg      = pc === 0 ? 'transparent' : revChg > 0
                                  ? `rgba(16,185,129,${opacity})`
                                  : `rgba(239,68,68,${opacity})`
                                return (
                                  <td key={pc} className="py-1.5 px-2 text-center font-medium"
                                    style={{ background: bg, color: pc === 0 ? '#475569' : revChg > 0 ? '#10B981' : '#EF4444' }}>
                                    {pc === 0 ? '—' : `${revChg > 0 ? '+' : ''}${revChg.toFixed(1)}%`}
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <Spinner />}
                </div>

                {/* Price recommendations */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Price Recommendations</h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                        {['SKU','Brand','Elasticity','Avg Price','Recommendation','Rationale'].map(h => (
                          <th key={h} className={`pb-2 font-medium ${h === 'SKU' ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {top20.map(sku => {
                        const rec = sku.elasticity > -1.5 ? { text: '+5-8%', color: '#10B981', rationale: 'Low elasticity — pricing power' } :
                                    sku.elasticity > -2.5 ? { text: '0-3%',   color: '#F59E0B', rationale: 'Moderate — small increases ok' } :
                                                            { text: 'Hold',   color: '#EF4444', rationale: 'High elasticity — volume at risk' }
                        return (
                          <tr key={sku.product_id} className="border-b border-border/50">
                            <td className="py-2 text-text-primary font-medium">{sku.sku_name.slice(0, 38)}</td>
                            <td className="py-2 text-right text-text-secondary">{sku.brand}</td>
                            <td className="py-2 text-right font-medium"
                              style={{ color: sku.elasticity > -2 ? '#10B981' : sku.elasticity > -3 ? '#F59E0B' : '#EF4444' }}>
                              {sku.elasticity.toFixed(2)}
                            </td>
                            <td className="py-2 text-right text-text-secondary">${sku.avg_price.toFixed(2)}</td>
                            <td className="py-2 text-right font-semibold" style={{ color: rec.color }}>{rec.text}</td>
                            <td className="py-2 text-right text-text-muted">{rec.rationale}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  )
}
