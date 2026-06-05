import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, ComposedChart, Line, ScatterChart, Scatter, ZAxis, Legend,
  ReferenceLine,
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { Spinner } from '../components/ui/Spinner'
import { useForecastData, useForecastAccuracy, useDecomposition, useProducts, useCustomers, useCategories } from '../api/queries'
import { fmtVolume } from '../lib/utils'
import { CHART_STYLE, tooltipStyle, CATEGORY_COLORS, PALETTE } from '../lib/chartTheme'

const TABS = [
  { id: 'forecast',  label: 'Forecast vs Actuals' },
  { id: 'accuracy',  label: 'Forecast Accuracy' },
  { id: 'decomp',    label: 'Demand Decomposition' },
]

export default function DemandForecasting() {
  const [selProd, setSelProd] = useState('')
  const [selCust, setSelCust] = useState('')
  const [decomCat, setDecomCat] = useState('Beverages')

  const { data: products } = useProducts()
  const { data: customers } = useCustomers()
  const { data: cats }      = useCategories()
  const { data: fc, isLoading: fcLoad } = useForecastData(selProd || undefined, selCust || undefined)
  const { data: acc, isLoading: accLoad } = useForecastAccuracy()
  const { data: decomp, isLoading: decompLoad } = useDecomposition(decomCat)

  // Build unified timeline for chart
  const fcChartData = (() => {
    if (!fc) return []
    const actMap: Record<string, number> = {}
    const fitMap: Record<string, number> = {}
    ;(fc.actuals ?? []).forEach(d => { actMap[d.week_date] = d.actual_volume })
    ;(fc.fitted ?? []).forEach(d => { fitMap[d.week_date] = d.forecast_volume })
    const allDates = Array.from(new Set([
      ...(fc.actuals ?? []).map(d => d.week_date),
      ...(fc.fitted ?? []).map(d => d.week_date),
    ])).sort()
    return allDates.slice(-78).map(d => ({
      date: d.slice(0, 10),
      actual:  actMap[d],
      fitted:  fitMap[d],
    }))
  })()

  const fwdData = (fc?.forecast_forward ?? []).map(d => ({
    date:    d.week_date.slice(0, 10),
    forecast: d.forecast_volume,
    upper:   d.upper_bound,
    lower:   d.lower_bound,
  }))

  const accSorted = [...(acc ?? [])].sort((a, b) => b.forecast_accuracy - a.forecast_accuracy)

  return (
    <div className="animate-slide-in">
      <PageHeader title="Demand Forecasting" subtitle="Statistical Forecasts · Accuracy (MAPE/WMAPE) · Demand Decomposition" />

      <Tabs tabs={TABS}>
        {(active) => (
          <>
            {/* ── Forecast vs Actuals ──────────────────────────────────────── */}
            {active === 'forecast' && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <select value={selProd} onChange={e => setSelProd(e.target.value)}
                    className="text-xs bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-text-secondary outline-none focus:border-accent-blue">
                    <option value="">All Products</option>
                    {(products ?? []).map(p => <option key={p.product_id} value={p.product_id}>{p.sku_name.slice(0, 50)}</option>)}
                  </select>
                  <select value={selCust} onChange={e => setSelCust(e.target.value)}
                    className="text-xs bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-text-secondary outline-none focus:border-accent-blue">
                    <option value="">All Customers</option>
                    {(customers ?? []).map(c => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}
                  </select>
                </div>

                <div className="grid xl:grid-cols-4 gap-4">
                  <div className="xl:col-span-3 card p-5">
                    <h3 className="text-sm font-semibold mb-4">
                      Demand Forecast — {selProd ? (products ?? []).find(p => p.product_id === selProd)?.sku_name?.slice(0, 45) : 'Portfolio'}
                    </h3>
                    {fcLoad ? <Spinner /> : (
                      <ResponsiveContainer width="100%" height={360}>
                        <ComposedChart margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                          <XAxis dataKey="date" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false}
                            tickFormatter={v => v.slice(0, 7)} interval={7} />
                          <YAxis tickFormatter={v => fmtVolume(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [fmtVolume(v) + ' cs', name]} />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                          <Area data={fcChartData} type="monotone" dataKey="actual" name="Actual"
                            stroke="#3B82F6" strokeWidth={2} fill="url(#actualGrad)" connectNulls />
                          <Line data={fcChartData} type="monotone" dataKey="fitted" name="Fitted"
                            stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 2" dot={false} connectNulls />
                          {fwdData.length > 0 && (
                            <>
                              <Area data={fwdData} type="monotone" dataKey="upper" name="Upper CI"
                                stroke="none" fill="#10B981" fillOpacity={0.08} legendType="none" />
                              <Area data={fwdData} type="monotone" dataKey="lower" name="Lower CI"
                                stroke="none" fill="#10B981" fillOpacity={0.08} legendType="none" />
                              <Line data={fwdData} type="monotone" dataKey="forecast" name="13wk Forecast"
                                stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: '#10B981' }} connectNulls />
                            </>
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="card p-5 space-y-4">
                    <h3 className="text-sm font-semibold">Forecast Summary</h3>
                    {fc && (
                      <>
                        {[
                          { label: 'Actuals (13wk avg)', value: fmtVolume((fc.actuals ?? []).slice(-13).reduce((s, d) => s + d.actual_volume, 0) / 13) + ' cs/wk', color: '#3B82F6' },
                          { label: '13wk Forecast avg',  value: fmtVolume((fc.forecast_forward ?? []).reduce((s, d) => s + d.forecast_volume, 0) / Math.max((fc.forecast_forward ?? []).length, 1)) + ' cs/wk', color: '#10B981' },
                          { label: 'Forecast Weeks',     value: String((fc.forecast_forward ?? []).length), color: '#94A3B8' },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="p-3 bg-bg-elevated rounded-lg border border-border">
                            <p className="label-xs mb-1">{label}</p>
                            <p className="text-xl font-bold" style={{ color }}>{value}</p>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Forecast Accuracy ────────────────────────────────────────── */}
            {active === 'accuracy' && (
              <>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Portfolio WMAPE', value: `${((acc ?? []).reduce((s, d) => s + d.wmape, 0) / Math.max((acc ?? []).length, 1)).toFixed(1)}%`, color: '#F59E0B' },
                    { label: 'Portfolio FA%',   value: `${((acc ?? []).reduce((s, d) => s + d.forecast_accuracy, 0) / Math.max((acc ?? []).length, 1)).toFixed(1)}%`, color: '#10B981' },
                    { label: 'Avg Bias',        value: `${((acc ?? []).reduce((s, d) => s + d.bias_pct, 0) / Math.max((acc ?? []).length, 1)).toFixed(1)}%`, color: '#06B6D4' },
                    { label: 'Brands Tracked',  value: String((acc ?? []).length), color: '#3B82F6' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card p-4 text-center" style={{ borderTop: `3px solid ${color}` }}>
                      <p className="label-xs mb-2">{label}</p>
                      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid xl:grid-cols-2 gap-4">
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Forecast Accuracy % by Brand</h3>
                    {accLoad ? <Spinner /> : (
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={accSorted} layout="vertical" margin={{ top: 0, right: 60, left: 0, bottom: 0 }}>
                          <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                          <XAxis type="number" tickFormatter={v => `${v}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} domain={[0, 110]} />
                          <YAxis type="category" dataKey="brand" tick={{ ...CHART_STYLE.tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Accuracy']} />
                          <ReferenceLine x={80} stroke="#10B981" strokeDasharray="4 2" label={{ value: 'Target 80%', fill: '#10B981', fontSize: 10, position: 'top' }} />
                          <Bar dataKey="forecast_accuracy" radius={[0, 3, 3, 0]}
                            label={{ position: 'right', fill: '#94A3B8', fontSize: 10, formatter: (v: number) => `${v.toFixed(0)}%` }}>
                            {accSorted.map((d, i) => (
                              <Cell key={i} fill={d.forecast_accuracy >= 80 ? '#10B981' : d.forecast_accuracy >= 70 ? '#F59E0B' : '#EF4444'} opacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">MAPE vs Bias by Category</h3>
                    <ResponsiveContainer width="100%" height={400}>
                      <ScatterChart margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid {...CHART_STYLE.grid} />
                        <XAxis dataKey="mape" type="number" name="MAPE%" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false}
                          tickFormatter={v => `${v}%`} label={{ value: 'MAPE % (lower = better)', fill: '#94A3B8', fontSize: 11, dy: 20 }} />
                        <YAxis dataKey="bias_pct" type="number" name="Bias%" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false}
                          tickFormatter={v => `${v}%`} label={{ value: 'Bias %', fill: '#94A3B8', fontSize: 11, angle: -90, dx: -15 }} />
                        <ZAxis range={[80, 300]} />
                        <Tooltip contentStyle={tooltipStyle} content={({ payload }) => {
                          const d = payload?.[0]?.payload
                          if (!d) return null
                          return (
                            <div style={tooltipStyle}>
                              <p className="font-semibold">{d.brand}</p>
                              <p>MAPE: {d.mape?.toFixed(1)}%</p>
                              <p>Bias: {d.bias_pct > 0 ? '+' : ''}{d.bias_pct?.toFixed(1)}%</p>
                              <p>FA: {d.forecast_accuracy?.toFixed(1)}%</p>
                            </div>
                          )
                        }} />
                        {Array.from(new Set((acc ?? []).map(d => d.category))).map((cat, i) => (
                          <Scatter key={cat} name={cat}
                            data={(acc ?? []).filter(d => d.category === cat)}
                            fill={CATEGORY_COLORS[cat] ?? PALETTE[i]} opacity={0.8}
                          />
                        ))}
                        <ReferenceLine y={0} stroke="#2D3460" strokeDasharray="3 3" />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}

            {/* ── Decomposition ────────────────────────────────────────────── */}
            {active === 'decomp' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="label-xs">Category</label>
                  <select value={decomCat} onChange={e => setDecomCat(e.target.value)}
                    className="text-xs bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-text-secondary outline-none focus:border-accent-blue">
                    {(cats ?? []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {decompLoad ? <Spinner /> : decomp && (() => {
                  const data = decomp.dates.map((d, i) => ({
                    date:      d.slice(0, 10),
                    actual:    decomp.actual[i],
                    trend:     decomp.trend[i],
                    seasonal:  decomp.seasonal[i],
                    irregular: decomp.irregular[i],
                  }))
                  const panels: { key: keyof typeof data[0]; color: string; title: string }[] = [
                    { key: 'actual',   color: '#3B82F6', title: 'Observed' },
                    { key: 'trend',    color: '#10B981', title: 'Trend' },
                    { key: 'seasonal', color: '#F59E0B', title: 'Seasonal' },
                    { key: 'irregular',color: '#8B5CF6', title: 'Irregular' },
                  ]
                  return (
                    <div className="space-y-2">
                      {panels.map(({ key, color, title }) => (
                        <div key={key} className="card p-4">
                          <p className="text-xs font-medium text-text-secondary mb-2">{title}</p>
                          <ResponsiveContainer width="100%" height={110}>
                            <AreaChart data={data} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <XAxis dataKey="date" tick={false} axisLine={false} tickLine={false} />
                              <YAxis tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false}
                                tickFormatter={v => fmtVolume(v)} width={50} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtVolume(v) + ' cs', title]} />
                              <Area type="monotone" dataKey={key as string} stroke={color} strokeWidth={1.5} fill={`url(#grad-${key})`} dot={false} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  )
}
