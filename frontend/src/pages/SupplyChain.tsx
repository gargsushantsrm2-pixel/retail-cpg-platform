import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, LineChart, Line, Legend, ReferenceLine, PieChart, Pie,
  AreaChart, Area,
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import { RiskBadge } from '../components/ui/Badge'
import { Spinner } from '../components/ui/Spinner'
import { useInventoryHealth, useServiceLevels, useReplenishment } from '../api/queries'
import { fmtVolume } from '../lib/utils'
import { CHART_STYLE, tooltipStyle, PALETTE } from '../lib/chartTheme'

const TABS = [
  { id: 'inventory', label: 'Inventory Health' },
  { id: 'service',   label: 'Service Levels' },
  { id: 'alerts',    label: 'Replenishment Alerts' },
]

export default function SupplyChain() {
  const { data: inv,    isLoading: invLoad    } = useInventoryHealth()
  const { data: svc,    isLoading: svcLoad    } = useServiceLevels()
  const { data: alerts, isLoading: alertsLoad } = useReplenishment()

  const critical = (alerts ?? []).filter(a => a.urgency === 'CRITICAL')
  const high     = (alerts ?? []).filter(a => a.urgency === 'HIGH')
  const medium   = (alerts ?? []).filter(a => a.urgency === 'MEDIUM')

  const invSorted = [...(inv ?? [])].sort((a, b) => a.avg_woc - b.avg_woc)
  const wocTop25  = invSorted.slice(0, 25)

  const riskCounts = ['Critical', 'Low', 'Healthy'].map(r => ({
    name: r, value: (inv ?? []).filter(d => d.risk_flag === r).length,
    fill: r === 'Critical' ? '#EF4444' : r === 'Low' ? '#F59E0B' : '#10B981',
  }))

  const monthly = (svc?.monthly_trend ?? []).map(d => ({
    ...d,
    month: d.month?.slice(0, 7) ?? '',
  })).sort((a, b) => a.month.localeCompare(b.month))

  return (
    <div className="animate-slide-in">
      <PageHeader title="Supply Chain Intelligence" subtitle="Inventory Health · Service Levels · OTIF · Replenishment Alerts" />

      {/* Alert summary */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: 'Critical (WoC < 1w)', count: critical.length, color: '#EF4444', bg: 'rgba(239,68,68,0.07)' },
          { label: 'High (WoC < 1.5w)',   count: high.length,     color: '#F59E0B', bg: 'rgba(245,158,11,0.07)' },
          { label: 'Medium (WoC < 2.5w)', count: medium.length,   color: '#3B82F6', bg: 'rgba(59,130,246,0.07)' },
        ].map(({ label, count, color, bg }) => (
          <div key={label} className="rounded-xl border p-4" style={{ background: bg, borderColor: color }}>
            <p className="text-xs font-semibold mb-1" style={{ color }}>{label}</p>
            <p className="text-3xl font-bold text-text-primary">{count}</p>
            <p className="text-xs text-text-muted">alerts active</p>
          </div>
        ))}
      </div>

      <Tabs tabs={TABS}>
        {(active) => (
          <>
            {/* ── Inventory Health ────────────────────────────────────────── */}
            {active === 'inventory' && (
              <div className="space-y-4">
                <div className="grid xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2 card p-5">
                    <h3 className="text-sm font-semibold mb-4">Weeks of Cover by SKU — Latest Week</h3>
                    {invLoad ? <Spinner /> : (
                      <ResponsiveContainer width="100%" height={460}>
                        <BarChart data={wocTop25} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                          <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                          <XAxis type="number" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false}
                            tickFormatter={v => `${v}w`} />
                          <YAxis type="category" dataKey="sku_name" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }}
                            axisLine={false} tickLine={false} width={200}
                            tickFormatter={(v: string) => v.slice(0, 32)} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}w`, 'WoC']} />
                          <ReferenceLine x={2} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: 'Min 2w', fill: '#F59E0B', fontSize: 10, position: 'top' }} />
                          <ReferenceLine x={4} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Target 4w', fill: '#10B981', fontSize: 10, position: 'top' }} />
                          <Bar dataKey="avg_woc" radius={[0, 3, 3, 0]}
                            label={{ position: 'right', fill: '#94A3B8', fontSize: 9, formatter: (v: number) => `${v.toFixed(1)}w` }}>
                            {wocTop25.map((d, i) => (
                              <Cell key={i} fill={d.avg_woc < 1 ? '#EF4444' : d.avg_woc < 2 ? '#F59E0B' : '#10B981'} opacity={0.85} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="card p-5">
                      <h3 className="text-sm font-semibold mb-3">Risk Distribution</h3>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={riskCounts} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                            dataKey="value" nameKey="name"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}>
                            {riskCounts.map((d, i) => <Cell key={i} fill={d.fill} opacity={0.85} />)}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="card p-5">
                      <h3 className="text-sm font-semibold mb-3">WoC by Category</h3>
                      {(inv ?? []).length > 0 && (() => {
                        const catMap: Record<string, number[]> = {}
                        ;(inv ?? []).forEach(d => { catMap[d.category] = catMap[d.category] ?? []; catMap[d.category].push(d.avg_woc) })
                        return Object.entries(catMap).map(([cat, vals]) => {
                          const avg = vals.reduce((s, v) => s + v, 0) / vals.length
                          return (
                            <div key={cat} className="flex justify-between text-xs py-1.5 border-b border-border/50">
                              <span className="text-text-secondary">{cat}</span>
                              <span className="font-medium" style={{ color: avg < 2 ? '#EF4444' : avg < 3 ? '#F59E0B' : '#10B981' }}>
                                {avg.toFixed(1)}w
                              </span>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  </div>
                </div>

                {/* Detail table */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-3">Inventory Detail</h3>
                  <div className="overflow-auto max-h-56">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-bg-card">
                        <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                          {['SKU','Brand','Category','Avg WoC','On Hand','In Transit','OOS%','Risk'].map(h => (
                            <th key={h} className={`pb-2 font-medium ${h === 'SKU' ? 'text-left' : 'text-right'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {invSorted.slice(0, 50).map(d => (
                          <tr key={d.product_id} className="border-b border-border/50 hover:bg-bg-elevated/40">
                            <td className="py-1.5 text-text-primary font-medium">{d.sku_name.slice(0, 38)}</td>
                            <td className="py-1.5 text-right text-text-secondary">{d.brand}</td>
                            <td className="py-1.5 text-right text-text-secondary">{d.category}</td>
                            <td className="py-1.5 text-right font-medium"
                              style={{ color: d.avg_woc < 1 ? '#EF4444' : d.avg_woc < 2 ? '#F59E0B' : '#10B981' }}>
                              {d.avg_woc.toFixed(1)}w
                            </td>
                            <td className="py-1.5 text-right text-text-secondary">{fmtVolume(d.total_on_hand)}</td>
                            <td className="py-1.5 text-right text-text-secondary">{fmtVolume(d.total_in_transit)}</td>
                            <td className="py-1.5 text-right text-text-muted">{d.oos_rate_pct.toFixed(0)}%</td>
                            <td className="py-1.5 text-right"><RiskBadge risk={d.risk_flag} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Service Levels ───────────────────────────────────────────── */}
            {active === 'service' && (
              <div className="space-y-4">
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Fill Rate & OTIF — Monthly Trend</h3>
                  {svcLoad ? <Spinner /> : (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={monthly} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                        <XAxis dataKey="month" tick={{ ...CHART_STYLE.tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `${v}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} domain={[85, 102]} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name]} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                        <ReferenceLine y={95} stroke="#F59E0B" strokeDasharray="4 2" label={{ value: 'Target 95%', fill: '#F59E0B', fontSize: 10, position: 'right' }} />
                        <Line type="monotone" dataKey="fill_rate_pct" name="Fill Rate %" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3, fill: '#10B981' }} />
                        <Line type="monotone" dataKey="otif_pct"      name="OTIF %"      stroke="#3B82F6" strokeWidth={2}   dot={{ r: 3, fill: '#3B82F6' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="grid xl:grid-cols-2 gap-4">
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Fill Rate by Category — CY2024</h3>
                    {(() => {
                      const byCat = (svc?.by_category ?? []).filter((d: any) => d.year === 2024)
                      return (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={byCat} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                            <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                            <XAxis type="number" tickFormatter={v => `${v.toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} domain={[80, 105]} />
                            <YAxis type="category" dataKey="category" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} width={90} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Fill Rate']} />
                            <ReferenceLine x={95} stroke="#F59E0B" strokeDasharray="3 3" />
                            <Bar dataKey="fill_rate" radius={[0, 3, 3, 0]}
                              label={{ position: 'right', fill: '#94A3B8', fontSize: 10, formatter: (v: number) => `${v?.toFixed(1)}%` }}>
                              {byCat.map((d: any, i: number) => (
                                <Cell key={i} fill={d.fill_rate >= 95 ? '#10B981' : d.fill_rate >= 90 ? '#F59E0B' : '#EF4444'} opacity={0.85} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )
                    })()}
                  </div>
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Avg WoC Trend</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="wocGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#06B6D4" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                        <XAxis dataKey="month" tick={{ ...CHART_STYLE.tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `${v.toFixed(1)}w`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}w`, 'WoC']} />
                        <ReferenceLine y={2} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Min', fill: '#EF4444', fontSize: 10 }} />
                        <ReferenceLine y={4} stroke="#10B981" strokeDasharray="3 3" label={{ value: 'Target', fill: '#10B981', fontSize: 10 }} />
                        <Area type="monotone" dataKey="avg_woc" stroke="#06B6D4" strokeWidth={2} fill="url(#wocGrad)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* ── Alerts ───────────────────────────────────────────────────── */}
            {active === 'alerts' && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-4">Active Replenishment Alerts</h3>
                {alertsLoad ? <Spinner /> : (
                  <div className="space-y-2">
                    {[...(alerts ?? [])].sort((a, b) => {
                      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 }
                      return order[a.urgency] - order[b.urgency]
                    }).map((alert, i) => {
                      const colorMap: Record<string, string> = { CRITICAL: '#EF4444', HIGH: '#F59E0B', MEDIUM: '#3B82F6' }
                      const bgMap: Record<string, string>   = { CRITICAL: 'rgba(239,68,68,0.06)', HIGH: 'rgba(245,158,11,0.06)', MEDIUM: 'rgba(59,130,246,0.06)' }
                      const color = colorMap[alert.urgency]
                      const bg    = bgMap[alert.urgency]
                      return (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border"
                          style={{ background: bg, borderColor: color }}>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <RiskBadge risk={alert.urgency} />
                              <span className="text-sm font-semibold text-text-primary">
                                {alert.sku_name?.slice(0, 50) ?? alert.product_id}
                              </span>
                            </div>
                            <p className="text-xs text-text-secondary">Warehouse: {alert.warehouse}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold" style={{ color }}>{alert.weeks_of_cover.toFixed(1)}w</p>
                            <p className="text-xs text-text-muted">on hand</p>
                            <p className="text-xs text-text-primary mt-0.5">
                              Suggest: {alert.suggested_order.toLocaleString()} cs
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  )
}
