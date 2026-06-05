import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ResponsiveContainer, ComposedChart, Line, Legend,
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import { Tabs } from '../components/ui/Tabs'
import WaterfallChart from '../components/charts/WaterfallChart'
import { Spinner } from '../components/ui/Spinner'
import { useCustomerPL, useTradeEffectiveness } from '../api/queries'
import { fmtCurrency } from '../lib/utils'
import { CHART_STYLE, tooltipStyle, PALETTE } from '../lib/chartTheme'
import type { WaterfallItem } from '../types'

const TABS = [
  { id: 'pl',    label: 'Customer P&L' },
  { id: 'trade', label: 'Trade Effectiveness' },
]

export default function CommercialExcellence() {
  const { data: cpl,   isLoading: cplLoad   } = useCustomerPL()
  const { data: trade, isLoading: tradeLoad  } = useTradeEffectiveness()

  const totals = cpl ? {
    gross:   cpl.reduce((s, d) => s + d.gross_revenue, 0),
    ts:      cpl.reduce((s, d) => s + d.trade_spend, 0),
    net:     cpl.reduce((s, d) => s + d.net_revenue, 0),
    gp:      cpl.reduce((s, d) => s + d.gross_profit, 0),
    sga:     cpl.reduce((s, d) => s + d.sga_allocated, 0),
    contrib: cpl.reduce((s, d) => s + d.customer_contribution, 0),
  } : null

  const waterfallData: WaterfallItem[] = totals ? [
    { label: 'Gross Revenue',        value: totals.gross,   type: 'total'    },
    { label: 'Trade Spend',          value: -totals.ts,     type: 'relative' },
    { label: 'Net Revenue',          value: totals.net,     type: 'total'    },
    { label: 'COGS',                 value: -(totals.net - totals.gp), type: 'relative' },
    { label: 'Gross Profit',         value: totals.gp,      type: 'total'    },
    { label: 'SG&A',                 value: -totals.sga,    type: 'relative' },
    { label: 'Customer Contribution',value: totals.contrib, type: 'total'    },
  ] : []

  const cplSorted = [...(cpl ?? [])].sort((a, b) => b.net_revenue - a.net_revenue)

  return (
    <div className="animate-slide-in">
      <PageHeader title="Commercial Excellence" subtitle="Customer P&L · Trade Spend Optimization · Net Revenue Realization" />

      {/* Portfolio KPIs */}
      {totals && (
        <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
          {[
            { label: 'Gross Revenue',          value: fmtCurrency(totals.gross),   color: '#3B82F6' },
            { label: 'Net Revenue',            value: fmtCurrency(totals.net),     color: '#06B6D4' },
            { label: 'Total Trade Spend',      value: fmtCurrency(totals.ts),      color: '#EF4444' },
            { label: 'Gross Profit',           value: fmtCurrency(totals.gp),      color: '#10B981' },
            { label: 'Customer Contribution',  value: fmtCurrency(totals.contrib), color: '#8B5CF6' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4 text-center" style={{ borderTop: `3px solid ${color}` }}>
              <p className="label-xs mb-2">{label}</p>
              <p className="text-xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs tabs={TABS}>
        {(active) => (
          <>
            {/* ── Customer P&L ─────────────────────────────────────────────── */}
            {active === 'pl' && (
              <div className="space-y-4">
                <div className="grid xl:grid-cols-3 gap-4">
                  <div className="xl:col-span-2 card p-5">
                    <h3 className="text-sm font-semibold mb-4">Portfolio P&L Waterfall — CY2024</h3>
                    {cplLoad ? <Spinner /> : <WaterfallChart data={waterfallData} height={320} />}
                  </div>
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Net Revenue by Customer</h3>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={cplSorted} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                        <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                        <XAxis type="number" tickFormatter={v => fmtCurrency(v)} tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="customer_name" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }}
                          axisLine={false} tickLine={false} width={120}
                          tickFormatter={(v: string) => v.replace(' / Sam\'s Club', '')} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtCurrency(v), 'Net Revenue']} />
                        <Bar dataKey="net_revenue" radius={[0, 3, 3, 0]}>
                          {cplSorted.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} opacity={0.85} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* P&L table */}
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-3">Customer P&L Detail</h3>
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                          {['Customer','Channel','Tier','Gross Rev','Trade Spend','Net Rev','GM%','Trade%','Contrib%'].map(h => (
                            <th key={h} className={`pb-2 font-medium ${h === 'Customer' ? 'text-left' : 'text-right'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cplSorted.map(d => (
                          <tr key={d.customer_id} className="border-b border-border/50 hover:bg-bg-elevated/40">
                            <td className="py-2 text-text-primary font-medium">{d.customer_name.replace(' / Sam\'s Club', '')}</td>
                            <td className="py-2 text-right text-text-secondary">{d.channel}</td>
                            <td className="py-2 text-right text-text-muted">{d.tier}</td>
                            <td className="py-2 text-right text-text-secondary">{fmtCurrency(d.gross_revenue)}</td>
                            <td className="py-2 text-right text-accent-red">{fmtCurrency(d.trade_spend)}</td>
                            <td className="py-2 text-right text-text-primary font-medium">{fmtCurrency(d.net_revenue)}</td>
                            <td className="py-2 text-right text-accent-green">{d.gross_margin_pct.toFixed(1)}%</td>
                            <td className="py-2 text-right text-accent-amber">{d.trade_spend_pct.toFixed(1)}%</td>
                            <td className="py-2 text-right"
                              style={{ color: d.contribution_margin_pct > 0 ? '#10B981' : '#EF4444' }}>
                              {d.contribution_margin_pct.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ── Trade Effectiveness ──────────────────────────────────────── */}
            {active === 'trade' && (
              <div className="space-y-4">
                <div className="grid xl:grid-cols-2 gap-4">
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Trade ROI by Customer</h3>
                    {tradeLoad ? <Spinner /> : (() => {
                      const sorted = [...(trade?.by_customer ?? [])].sort((a, b) => a.roi - b.roi)
                      return (
                        <ResponsiveContainer width="100%" height={280}>
                          <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                            <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                            <XAxis type="number" tickFormatter={v => `${v}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="customer_name" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }}
                              axisLine={false} tickLine={false} width={110}
                              tickFormatter={(v: string) => v.replace(' / Sam\'s Club', '')} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, 'ROI']} />
                            <Bar dataKey="roi" radius={[0, 3, 3, 0]}
                              label={{ position: 'right', fill: '#94A3B8', fontSize: 9, formatter: (v: number) => `${v?.toFixed(0)}%` }}>
                              {sorted.map((d, i) => <Cell key={i} fill={d.roi > 0 ? '#10B981' : '#EF4444'} opacity={0.85} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )
                    })()}
                  </div>
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Spend vs Incremental Revenue by Customer</h3>
                    {tradeLoad ? <Spinner /> : (
                      <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={trade?.by_customer ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                          <XAxis dataKey="customer_name" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false}
                            tickFormatter={(v: string) => v.slice(0, 8)} />
                          <YAxis tickFormatter={v => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: number, name: string) => [fmtCurrency(v), name]} />
                          <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                          <Bar dataKey="trade_spend"    name="Trade Spend"    fill="#EF4444" opacity={0.75} />
                          <Bar dataKey="incremental_rev" name="Incr. Revenue"  fill="#10B981" opacity={0.75} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
                <div className="grid xl:grid-cols-2 gap-4">
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">ROI by Promotion Type</h3>
                    {(() => {
                      const sorted = [...(trade?.by_type ?? [])].sort((a, b) => b.roi - a.roi)
                      return (
                        <ResponsiveContainer width="100%" height={240}>
                          <BarChart data={sorted} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                            <XAxis dataKey="promo_type" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={v => `${v}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, 'ROI']} />
                            <Bar dataKey="roi" radius={[3, 3, 0, 0]}
                              label={{ position: 'top', fill: '#94A3B8', fontSize: 10, formatter: (v: number) => `${v?.toFixed(0)}%` }}>
                              {sorted.map((d, i) => <Cell key={i} fill={d.roi > 0 ? '#10B981' : '#EF4444'} opacity={0.85} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      )
                    })()}
                  </div>
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-4">Average Volume Lift by Promo Type</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={trade?.by_type ?? []} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                        <XAxis dataKey="promo_type" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(0)}%`, 'Avg Lift']} />
                        <Bar dataKey="avg_lift" radius={[3, 3, 0, 0]}>
                          {(trade?.by_type ?? []).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} opacity={0.85} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
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
