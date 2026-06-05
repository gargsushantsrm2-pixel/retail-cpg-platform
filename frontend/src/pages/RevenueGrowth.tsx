import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, ComposedChart, Line, ScatterChart,
  Scatter, ZAxis, Legend,
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import WaterfallChart from '../components/charts/WaterfallChart'
import { Spinner } from '../components/ui/Spinner'
import { useWaterfall, usePromoROI, usePriceElasticity, useMixAnalysis, useCategories } from '../api/queries'
import { fmtCurrency, fmtPct } from '../lib/utils'
import { CHART_STYLE, tooltipStyle, PALETTE, CATEGORY_COLORS } from '../lib/chartTheme'

const TABS = [
  { id: 'waterfall', label: 'Revenue Waterfall' },
  { id: 'elasticity', label: 'Price Elasticity' },
  { id: 'promo',      label: 'Promo ROI' },
  { id: 'mix',        label: 'Mix Analysis' },
]

export default function RevenueGrowth() {
  const [selCat, setSelCat] = useState<string | undefined>()
  const { data: wf,    isLoading: wfLoad } = useWaterfall()
  const { data: promo, isLoading: promoLoad } = usePromoROI()
  const { data: elast, isLoading: elastLoad } = usePriceElasticity(selCat)
  const { data: mix,   isLoading: mixLoad } = useMixAnalysis()
  const { data: cats } = useCategories()

  return (
    <div className="animate-slide-in">
      <PageHeader title="Revenue Growth Management" subtitle="Price Elasticity · Promo ROI · Revenue Waterfall · Mix Analysis" />

      <Tabs tabs={TABS}>
        {(active) => (
          <>
            {/* ── Waterfall ───────────────────────────────────────────────── */}
            {active === 'waterfall' && (
              <div className="grid xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 card p-5">
                  <h3 className="text-sm font-semibold mb-4">Revenue Bridge — CY2024 vs PY2023</h3>
                  {wfLoad ? <Spinner /> : wf && (
                    <WaterfallChart data={wf.waterfall} height={340} />
                  )}
                </div>
                <div className="card p-5 space-y-4">
                  <h3 className="text-sm font-semibold">Bridge Summary</h3>
                  {wf && (
                    <>
                      {[
                        { label: 'PY Revenue',     value: wf.py_revenue,    color: '#475569' },
                        { label: 'CY Revenue',     value: wf.cy_revenue,    color: '#3B82F6' },
                        { label: 'Total Change',   value: wf.total_change,  color: wf.total_change >= 0 ? '#10B981' : '#EF4444' },
                      ].map(r => (
                        <div key={r.label} className="flex justify-between items-center py-2 border-b border-border">
                          <span className="text-sm text-text-secondary">{r.label}</span>
                          <span className="font-semibold text-sm" style={{ color: r.color }}>{fmtCurrency(r.value)}</span>
                        </div>
                      ))}
                      <div className="pt-2 space-y-2">
                        {[
                          { label: '📦 Volume Effect', value: wf.volume_effect },
                          { label: '💲 Price Effect',  value: wf.price_effect  },
                          { label: '🔀 Mix Effect',    value: wf.mix_effect    },
                        ].map(d => (
                          <div key={d.label} className="flex justify-between text-sm">
                            <span className="text-text-secondary">{d.label}</span>
                            <span style={{ color: d.value >= 0 ? '#10B981' : '#EF4444' }}>
                              {d.value >= 0 ? '+' : ''}{fmtCurrency(d.value)}
                              &nbsp;({wf.py_revenue ? fmtPct(d.value / wf.py_revenue * 100) : '—'})
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Price Elasticity ─────────────────────────────────────────── */}
            {active === 'elasticity' && (
              <div className="grid xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold">Price Elasticity by SKU (Log-Log Regression)</h3>
                    <select
                      value={selCat ?? ''}
                      onChange={e => setSelCat(e.target.value || undefined)}
                      className="text-xs bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-text-secondary outline-none focus:border-accent-blue"
                    >
                      <option value="">All Categories</option>
                      {(cats ?? []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {elastLoad ? <Spinner /> : (
                    <ResponsiveContainer width="100%" height={480}>
                      <BarChart
                        data={(elast ?? []).slice(0, 25).map(d => ({ ...d, name: d.sku_name.slice(0, 38) }))}
                        layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                        <XAxis type="number" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false}
                          domain={['dataMin', 0]} tickFormatter={v => v.toFixed(1)} />
                        <YAxis type="category" dataKey="name" tick={{ ...CHART_STYLE.tickStyle, fontSize: 10 }}
                          axisLine={false} tickLine={false} width={220} />
                        <Tooltip contentStyle={tooltipStyle}
                          formatter={(v: number) => [v.toFixed(2), 'Elasticity']} />
                        <Bar dataKey="elasticity" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: '#94A3B8', fontSize: 10 }}>
                          {(elast ?? []).slice(0, 25).map((d, i) => (
                            <Cell key={i} fill={d.elasticity > -2 ? '#10B981' : d.elasticity > -3 ? '#F59E0B' : '#EF4444'} opacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Portfolio Insights</h3>
                  {elast && (
                    <div className="space-y-4">
                      <div className="p-3 bg-bg-elevated rounded-lg border border-border">
                        <p className="label-xs mb-1">Portfolio Average</p>
                        <p className="text-3xl font-bold text-accent-amber">
                          {(elast.reduce((s, d) => s + d.elasticity, 0) / elast.length).toFixed(2)}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">1% price ↑ → {Math.abs(elast.reduce((s, d) => s + d.elasticity, 0) / elast.length).toFixed(1)}% vol ↓</p>
                      </div>
                      {[
                        { label: 'Most Elastic',  idx: elast.reduce((mi, d, i, a) => d.elasticity < a[mi].elasticity ? i : mi, 0), color: '#EF4444' },
                        { label: 'Least Elastic', idx: elast.reduce((mi, d, i, a) => d.elasticity > a[mi].elasticity ? i : mi, 0), color: '#10B981' },
                      ].map(({ label, idx, color }) => (
                        <div key={label} className="p-3 bg-bg-elevated rounded-lg border-l-2" style={{ borderColor: color }}>
                          <p className="label-xs mb-1">{label}</p>
                          <p className="text-sm font-semibold text-text-primary truncate">{elast[idx]?.sku_name}</p>
                          <p className="text-xs mt-0.5" style={{ color }}>{elast[idx]?.elasticity.toFixed(2)}</p>
                        </div>
                      ))}
                      <div>
                        <p className="label-xs mb-2">By Category</p>
                        {Array.from(new Set(elast.map(d => d.category))).map(cat => {
                          const catElast = elast.filter(d => d.category === cat)
                          const avg = catElast.reduce((s, d) => s + d.elasticity, 0) / catElast.length
                          return (
                            <div key={cat} className="flex justify-between text-xs py-1 border-b border-border/50">
                              <span className="text-text-secondary">{cat}</span>
                              <span className="font-medium" style={{ color: avg > -2 ? '#10B981' : avg > -3 ? '#F59E0B' : '#EF4444' }}>
                                {avg.toFixed(2)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Promo ROI ──────────────────────────────────────────────────── */}
            {active === 'promo' && (
              <div className="grid xl:grid-cols-2 gap-4">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Trade Spend vs Incremental Revenue</h3>
                  {promoLoad ? <Spinner /> : (
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={promo ?? []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                        <XAxis dataKey="promo_type" tick={{ ...CHART_STYLE.tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tickFormatter={v => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [
                          name === 'roi_pct' ? `${v.toFixed(1)}%` : fmtCurrency(v), name,
                        ]} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                        <Bar yAxisId="left" dataKey="trade_spend"          name="Trade Spend"     fill="#EF4444" opacity={0.75} />
                        <Bar yAxisId="left" dataKey="incremental_revenue"  name="Incr. Revenue"   fill="#10B981" opacity={0.75} />
                        <Line yAxisId="right" type="monotone" dataKey="roi_pct" name="ROI %" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 5, fill: '#F59E0B' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Promo Efficiency Scorecard</h3>
                  <div className="space-y-3">
                    {(promo ?? []).map(p => (
                      <div key={p.promo_type} className="p-3 bg-bg-elevated rounded-lg border border-border">
                        <div className="flex justify-between mb-2">
                          <span className="font-medium text-sm">{p.promo_type}</span>
                          <span className={`font-bold text-sm ${p.roi_pct > 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                            ROI: {p.roi_pct > 0 ? '+' : ''}{p.roi_pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex gap-4 text-xs text-text-secondary">
                          <span>Lift: <b className="text-text-primary">{p.avg_lift_pct.toFixed(0)}%</b></span>
                          <span>Events: <b className="text-text-primary">{p.num_events.toLocaleString()}</b></span>
                          <span>Spend: <b className="text-accent-red">{fmtCurrency(p.trade_spend)}</b></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Mix Analysis ───────────────────────────────────────────────── */}
            {active === 'mix' && (
              <div className="grid xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 card p-5">
                  <h3 className="text-sm font-semibold mb-4">Brand Growth Matrix — Revenue vs Volume</h3>
                  {mixLoad ? <Spinner /> : (
                    <ResponsiveContainer width="100%" height={420}>
                      <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid {...CHART_STYLE.grid} />
                        <XAxis dataKey="vol_growth"  type="number" name="Vol Growth %" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false}
                          tickFormatter={v => `${v}%`} label={{ value: 'Volume Growth %', fill: '#94A3B8', fontSize: 11, dy: 20 }} />
                        <YAxis dataKey="rev_growth"  type="number" name="Rev Growth %" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false}
                          tickFormatter={v => `${v}%`} label={{ value: 'Revenue Growth %', fill: '#94A3B8', fontSize: 11, angle: -90, dx: -15 }} />
                        <ZAxis dataKey="revenue" range={[60, 600]} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: '3 3', stroke: '#2D3460' }}
                          content={({ payload }) => {
                            const d = payload?.[0]?.payload
                            if (!d) return null
                            return (
                              <div style={tooltipStyle}>
                                <p className="font-semibold">{d.brand}</p>
                                <p className="text-text-secondary text-xs">{d.category}</p>
                                <p>Rev Growth: {fmtPct(d.rev_growth)}</p>
                                <p>Vol Growth: {fmtPct(d.vol_growth)}</p>
                              </div>
                            )
                          }} />
                        {Array.from(new Set((mix ?? []).map(d => d.category))).map((cat, i) => (
                          <Scatter key={cat} name={cat}
                            data={(mix ?? []).filter(d => d.category === cat)}
                            fill={CATEGORY_COLORS[cat] ?? PALETTE[i]} opacity={0.8}
                          />
                        ))}
                        <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Mix Performance Table</h3>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                          <th className="pb-2 text-left font-medium">Brand</th>
                          <th className="pb-2 text-right font-medium">Rev Δ%</th>
                          <th className="pb-2 text-right font-medium">Price Δ%</th>
                          <th className="pb-2 text-right font-medium">Vol Δ%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(mix ?? []).map(d => (
                          <tr key={d.brand} className="border-b border-border/50">
                            <td className="py-2 font-medium text-text-primary">{d.brand}</td>
                            {[d.rev_growth, d.price_change, d.vol_growth].map((v, i) => (
                              <td key={i} className="py-2 text-right font-medium text-xs"
                                style={{ color: v >= 0 ? '#10B981' : '#EF4444' }}>
                                {v >= 0 ? '+' : ''}{v.toFixed(1)}%
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  )
}
