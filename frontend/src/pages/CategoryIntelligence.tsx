import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis, LineChart, Line, Legend,
  ComposedChart,
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { Spinner } from '../components/ui/Spinner'
import { useAssortment, useSubcatTrends, useMarketShare } from '../api/queries'
import { fmtCurrency, fmtVolume } from '../lib/utils'
import { CHART_STYLE, tooltipStyle, CATEGORY_COLORS, PALETTE } from '../lib/chartTheme'

const TABS = [
  { id: 'assortment', label: 'Assortment' },
  { id: 'subcat',     label: 'Subcategory Trends' },
  { id: 'share',      label: 'Market Share' },
]

const OUR_BRANDS = new Set([
  'BrewMaster','VoltEdge','PureFlow','SunHarvest','CrispTea','FitFuel',
  'CrunchCraft','GoldenBake','NutHouse','EnergyBar','SweetBite',
  'LuxeShine','FreshGuard','SilkSkin','SparkleSmile',
  'TidePro','BrightClean','SoftTouch','AirFresh','DishMate',
  'CreekFarm','AlpineGold','MeadowFresh','SipWell','WhipDream',
])

export default function CategoryIntelligence() {
  const [filterCat, setFilterCat] = useState('')
  const [msCat, setMsCat]         = useState('Beverages')

  const { data: assortment, isLoading: assortLoad } = useAssortment()
  const { data: subcat,     isLoading: subcatLoad  } = useSubcatTrends()
  const { data: mktShare                            } = useMarketShare()

  const cats = Array.from(new Set((assortment ?? []).map(d => d.category))).sort()
  const filtered = filterCat ? (assortment ?? []).filter(d => d.category === filterCat) : (assortment ?? [])

  // Pareto accumulation
  let cumRev = 0
  const totalRev = filtered.reduce((s, d) => s + d.revenue, 0)
  const sorted30 = [...filtered].sort((a, b) => b.revenue - a.revenue).slice(0, 30).map(d => {
    cumRev += d.revenue
    return { ...d, cumulative: (cumRev / totalRev) * 100 }
  })

  // Subcat pivot for selected category in subcat tab
  const subcatCats = Array.from(new Set((subcat ?? []).map(d => d.category))).sort()
  const [subcatSel, setSubcatSel] = useState('Beverages')
  const subcatFiltered = (subcat ?? []).filter(d => d.category === subcatSel)
  const quarters = Array.from(new Set(subcatFiltered.map(d => d.quarter_label))).sort()
  const subcatNames = Array.from(new Set(subcatFiltered.map(d => d.subcategory)))
  const subcatChartData = quarters.map(q => {
    const row: Record<string, any> = { quarter: q }
    subcatNames.forEach(sc => {
      row[sc] = subcatFiltered.find(d => d.quarter_label === q && d.subcategory === sc)?.revenue ?? 0
    })
    return row
  })

  // Market share trend
  const msData = (mktShare ?? []).filter(d => d.category === msCat && d.month?.startsWith('2024'))
  const msBrands = Array.from(new Set(msData.map(d => d.brand)))
  const msMonths = Array.from(new Set(msData.map(d => d.month))).sort()
  const msChartData = msMonths.map(m => {
    const row: Record<string, any> = { month: m.slice(0, 7) }
    msBrands.forEach(b => { row[b] = msData.find(d => d.brand === b && d.month === m)?.volume_share ?? 0 })
    return row
  })
  const msCats = Array.from(new Set((mktShare ?? []).map(d => d.category))).sort()

  return (
    <div className="animate-slide-in">
      <PageHeader title="Category Intelligence" subtitle="Assortment Analytics · Subcategory Trends · Market Share" />

      <Tabs tabs={TABS}>
        {(active) => (
          <>
            {/* ── Assortment ──────────────────────────────────────────────── */}
            {active === 'assortment' && (
              <>
                {/* Summary KPIs */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Total Active SKUs', value: (assortment ?? []).length, color: '#3B82F6' },
                    { label: '80% Rev SKUs (Pareto)', value: (assortment ?? []).filter(d => d.pareto_flag).length, color: '#10B981' },
                    { label: 'High GM% (>45%)', value: (assortment ?? []).filter(d => d.gm_pct > 45).length, color: '#8B5CF6' },
                    { label: 'High Promo Dependency (>60%)', value: (assortment ?? []).filter(d => d.promo_freq_pct > 60).length, color: '#F59E0B' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="card p-4 text-center" style={{ borderTop: `3px solid ${color}` }}>
                      <p className="label-xs mb-2">{label}</p>
                      <p className="text-3xl font-bold text-text-primary">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid xl:grid-cols-3 gap-4 mb-4">
                  {/* Bubble chart */}
                  <div className="xl:col-span-2 card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold">Revenue vs Gross Margin — SKU Bubble Map</h3>
                      <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                        className="text-xs bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-text-secondary outline-none focus:border-accent-blue">
                        <option value="">All Categories</option>
                        {cats.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {assortLoad ? <Spinner /> : (
                      <ResponsiveContainer width="100%" height={340}>
                        <ScatterChart margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                          <CartesianGrid {...CHART_STYLE.grid} />
                          <XAxis dataKey="gm_pct" type="number" name="GM%" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false}
                            tickFormatter={v => `${v}%`} label={{ value: 'Gross Margin %', fill: '#94A3B8', fontSize: 11, dy: 20 }} />
                          <YAxis dataKey="revenue" type="number" name="Revenue" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false}
                            tickFormatter={v => fmtCurrency(v)} />
                          <ZAxis dataKey="revenue" range={[40, 400]} />
                          <Tooltip contentStyle={tooltipStyle} content={({ payload }) => {
                            const d = payload?.[0]?.payload
                            if (!d) return null
                            return (
                              <div style={tooltipStyle}>
                                <p className="font-semibold text-xs mb-1">{d.sku_name?.slice(0, 40)}</p>
                                <p className="text-text-secondary text-xs">{d.brand} · {d.category}</p>
                                <p>GM%: {d.gm_pct?.toFixed(1)}%</p>
                                <p>Revenue: {fmtCurrency(d.revenue)}</p>
                              </div>
                            )
                          }} />
                          {(filterCat ? [filterCat] : cats).map((cat, i) => (
                            <Scatter key={cat} name={cat}
                              data={filtered.filter(d => d.category === cat)}
                              fill={CATEGORY_COLORS[cat] ?? PALETTE[i]} opacity={0.75}
                            />
                          ))}
                          <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                  {/* Pareto */}
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Revenue Concentration (Pareto)</h3>
                    <ResponsiveContainer width="100%" height={340}>
                      <ComposedChart data={sorted30} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                        <XAxis dataKey="sku_name" tick={false} axisLine={false} tickLine={false} label={{ value: 'SKU Rank', fill: '#94A3B8', fontSize: 10, dy: 10 }} />
                        <YAxis yAxisId="left" tickFormatter={v => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v.toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} domain={[0, 110]} />
                        <Tooltip contentStyle={tooltipStyle} content={({ payload }) => {
                          const d = payload?.[0]?.payload
                          if (!d) return null
                          return (
                            <div style={tooltipStyle}>
                              <p className="font-semibold text-xs">{d.sku_name?.slice(0, 35)}</p>
                              <p>Revenue: {fmtCurrency(d.revenue)}</p>
                              <p>Cumulative: {d.cumulative?.toFixed(1)}%</p>
                            </div>
                          )
                        }} />
                        <Bar yAxisId="left" dataKey="revenue" fill="#3B82F6" opacity={0.7} radius={[2, 2, 0, 0]} />
                        <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#F59E0B" strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* SKU table */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">SKU Performance Detail</h3>
                  <div className="overflow-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-bg-card">
                        <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                          {['SKU Name','Brand','Category','Revenue','GM%','Promo%','Customers','Pareto'].map(h => (
                            <th key={h} className={`pb-2 font-medium ${h === 'SKU Name' ? 'text-left' : 'text-right'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.slice(0, 50).map(d => (
                          <tr key={d.product_id} className="border-b border-border/50 hover:bg-bg-elevated/50">
                            <td className="py-1.5 text-text-primary font-medium">{d.sku_name.slice(0, 40)}</td>
                            <td className="py-1.5 text-right text-text-secondary">{d.brand}</td>
                            <td className="py-1.5 text-right text-text-secondary">{d.category}</td>
                            <td className="py-1.5 text-right text-text-primary">{fmtCurrency(d.revenue)}</td>
                            <td className="py-1.5 text-right text-accent-green">{d.gm_pct.toFixed(1)}%</td>
                            <td className="py-1.5 text-right text-text-secondary">{d.promo_freq_pct.toFixed(0)}%</td>
                            <td className="py-1.5 text-right text-text-secondary">{d.num_customers}</td>
                            <td className="py-1.5 text-right">{d.pareto_flag && <span className="text-accent-green">✓</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* ── Subcategory Trends ───────────────────────────────────────── */}
            {active === 'subcat' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="label-xs">Category</label>
                  <select value={subcatSel} onChange={e => setSubcatSel(e.target.value)}
                    className="text-xs bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-text-secondary outline-none focus:border-accent-blue">
                    {subcatCats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2 card p-5">
                    <h3 className="text-sm font-semibold mb-4">Revenue by Subcategory × Quarter</h3>
                    {subcatLoad ? <Spinner /> : (
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={subcatChartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                          <XAxis dataKey="quarter" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                          <YAxis tickFormatter={v => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [fmtCurrency(v), name]} />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                          {subcatNames.map((sc, i) => (
                            <Bar key={sc} dataKey={sc} stackId="a" fill={PALETTE[i % PALETTE.length]} opacity={0.85} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Subcategory Revenue Share</h3>
                    {(() => {
                      const totals = subcatNames.map(sc => ({
                        name: sc,
                        revenue: subcatFiltered.filter(d => d.subcategory === sc).reduce((s, d) => s + d.revenue, 0),
                      })).sort((a, b) => b.revenue - a.revenue)
                      const total = totals.reduce((s, d) => s + d.revenue, 0)
                      return (
                        <div className="space-y-2 mt-2">
                          {totals.map((d, i) => (
                            <div key={d.name}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-text-secondary">{d.name}</span>
                                <span className="text-text-primary font-medium">{((d.revenue / total) * 100).toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-bg-elevated rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${(d.revenue / total) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ── Market Share ─────────────────────────────────────────────── */}
            {active === 'share' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="label-xs">Category</label>
                  <select value={msCat} onChange={e => setMsCat(e.target.value)}
                    className="text-xs bg-bg-elevated border border-border rounded-lg px-3 py-1.5 text-text-secondary outline-none focus:border-accent-blue">
                    {msCats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="grid xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2 card p-5">
                    <h3 className="text-sm font-semibold mb-4">Volume Market Share Trend — 2024</h3>
                    <ResponsiveContainer width="100%" height={340}>
                      <LineChart data={msChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid {...CHART_STYLE.grid} />
                        <XAxis dataKey="month" tick={{ ...CHART_STYLE.tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]} />
                        <Legend wrapperStyle={{ fontSize: 10, color: '#94A3B8' }} />
                        {msBrands.map((b, i) => (
                          <Line key={b} type="monotone" dataKey={b}
                            stroke={PALETTE[i % PALETTE.length]}
                            strokeWidth={OUR_BRANDS.has(b) ? 2.5 : 1}
                            strokeOpacity={OUR_BRANDS.has(b) ? 1 : 0.5}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Latest Share — {msCat}</h3>
                    <div className="space-y-1">
                      {(() => {
                        const latest = msData.filter(d => d.month === Math.max(...msData.map(x => x.month ? new Date(x.month).getTime() : 0)) + '')
                        const lastMonth = msData.map(d => d.month).sort().at(-1)
                        return msData
                          .filter(d => d.month === lastMonth)
                          .sort((a, b) => b.volume_share - a.volume_share)
                          .map((d, i) => {
                            const ours = OUR_BRANDS.has(d.brand)
                            return (
                              <div key={d.brand}
                                className={`flex justify-between items-center p-2 rounded-lg text-xs ${ours ? 'bg-accent-blue/5 border border-accent-blue/20' : ''}`}>
                                <span className={ours ? 'text-text-primary font-medium' : 'text-text-secondary'}>
                                  {ours ? '⬤ ' : '○ '}{d.brand}
                                </span>
                                <span className={`font-bold ${ours ? 'text-accent-blue' : 'text-text-muted'}`}>
                                  {d.volume_share.toFixed(1)}%
                                </span>
                              </div>
                            )
                          })
                      })()}
                    </div>
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
