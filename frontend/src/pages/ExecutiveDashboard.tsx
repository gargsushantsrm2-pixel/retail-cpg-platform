import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import PageHeader from '../components/ui/PageHeader'
import KpiCard    from '../components/ui/KpiCard'
import { Spinner } from '../components/ui/Spinner'
import {
  useExecutiveSummary, useRevenueTrend, useCategoryPerf,
  useTopPerformers, useMarketShare,
} from '../api/queries'
import { fmtCurrency, fmtVolume, fmtPct } from '../lib/utils'
import { CHART_STYLE, tooltipStyle, CATEGORY_COLORS, PALETTE } from '../lib/chartTheme'

const OUR_BRANDS = new Set([
  'BrewMaster','VoltEdge','PureFlow','SunHarvest','CrispTea','FitFuel',
  'CrunchCraft','GoldenBake','NutHouse','EnergyBar','SweetBite',
  'LuxeShine','FreshGuard','SilkSkin','SparkleSmile',
  'TidePro','BrightClean','SoftTouch','AirFresh','DishMate',
  'CreekFarm','AlpineGold','MeadowFresh','SipWell','WhipDream',
])

export default function ExecutiveDashboard() {
  const { data: summary, isLoading: loadingKpi } = useExecutiveSummary()
  const { data: trend,   isLoading: loadingTrend } = useRevenueTrend()
  const { data: catPerf                           } = useCategoryPerf()
  const { data: perf                              } = useTopPerformers(10)
  const { data: mktShare                          } = useMarketShare()

  // ── KPI data ──────────────────────────────────────────────────────────────
  const kpis = summary ? [
    { label: 'Net Revenue',    value: fmtCurrency(summary.revenue.value),      delta: summary.revenue.vs_py_pct,      accent: '#3B82F6' },
    { label: 'Volume (Cases)', value: fmtVolume(summary.volume.value),         delta: summary.volume.vs_py_pct,       accent: '#06B6D4' },
    { label: 'Gross Profit',   value: fmtCurrency(summary.gross_profit.value), delta: summary.gross_profit.vs_py_pct, accent: '#10B981' },
    { label: 'Gross Margin',   value: `${summary.gross_margin.value.toFixed(1)}%`, delta: summary.gross_margin.vs_py_pct, accent: '#8B5CF6' },
    { label: 'Avg Vol Share',  value: `${summary.market_share.value.toFixed(1)}%`, delta: summary.market_share.vs_py_pct, accent: '#F59E0B' },
    { label: 'Revenue on Promo', value: `${summary.promo_pct.value.toFixed(1)}%`, accent: '#EF4444' },
  ] : []

  // ── Revenue trend: monthly CY2024 ──────────────────────────────────────
  const cy2024 = (trend ?? [])
    .filter(d => d.year === 2024)
    .map(d => ({
      month: d.month?.slice(5, 7) ? new Date(d.month).toLocaleString('en-US', { month: 'short' }) : d.month,
      revenue:    d.revenue,
      revenue_py: d.revenue_py ?? 0,
      growth:     d.rev_vs_py_pct ?? 0,
    }))

  // ── Category share for CY2024 ─────────────────────────────────────────
  const catData = (catPerf ?? []).map(c => ({
    name:    c.category,
    revenue: c.revenue,
    growth:  c.rev_growth_pct,
    gm:      c.gm_pct,
    fill:    CATEGORY_COLORS[c.category] ?? '#3B82F6',
  }))

  // ── Market share by category (CY2024, our brands) ────────────────────
  const msMap: Record<string, number[]> = {}
  for (const d of (mktShare ?? [])) {
    if (OUR_BRANDS.has(d.brand) && d.month?.startsWith('2024')) {
      msMap[d.category] = msMap[d.category] ?? []
      msMap[d.category].push(d.volume_share)
    }
  }
  const msData = Object.entries(msMap).map(([cat, vals]) => ({
    category: cat,
    share: parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)),
    fill: CATEGORY_COLORS[cat] ?? '#3B82F6',
  }))

  return (
    <div className="animate-slide-in">
      <PageHeader
        title="Executive Dashboard"
        subtitle="CY2024 vs PY2023 — Revenue · Volume · Margin · Market Share"
      />

      {/* KPI row */}
      {loadingKpi ? <Spinner /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
          {kpis.map(k => (
            <KpiCard key={k.label} label={k.label} value={k.value} delta={k.delta} accent={k.accent} />
          ))}
        </div>
      )}

      {/* Revenue Trend */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-4">
        <div className="xl:col-span-3 card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Monthly Revenue — CY2024 vs PY2023</h3>
          {loadingTrend ? <Spinner /> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={cy2024} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                <XAxis dataKey="month" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtCurrency(v), '']} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
                <Area type="monotone" dataKey="revenue"    name="CY2024" stroke="#3B82F6" strokeWidth={2.5} fill="url(#cyGrad)" />
                <Area type="monotone" dataKey="revenue_py" name="PY2023" stroke="#475569" strokeWidth={1.5} fill="none" strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="xl:col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Revenue by Category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={catData} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
              <XAxis type="number" tickFormatter={v => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [fmtCurrency(v), 'Revenue']} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {catData.map((d, i) => <Cell key={i} fill={d.fill} opacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Customer Ranking + Market Share + Growth % */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Customer table */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Customer Revenue Ranking</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                <th className="pb-2 text-left font-medium">Customer</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {(perf?.customer_ranking ?? []).map((c, i) => {
                const total = (perf?.customer_ranking ?? []).reduce((s, x) => s + x.revenue, 0)
                return (
                  <tr key={c.customer_id} className="border-b border-border/50">
                    <td className="py-2 text-text-primary font-medium">
                      <span className="text-text-muted mr-2">{i + 1}</span>
                      {c.customer_name.replace(' / Sam\'s Club', '')}
                    </td>
                    <td className="py-2 text-right text-text-secondary">{fmtCurrency(c.revenue)}</td>
                    <td className="py-2 text-right text-accent-blue font-medium">
                      {((c.revenue / total) * 100).toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Market share */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Volume Market Share by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={msData} margin={{ top: 5, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="category" tick={{ ...CHART_STYLE.tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${v.toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, 'Vol Share']} />
              <Bar dataKey="share" radius={[4, 4, 0, 0]}>
                {msData.map((d, i) => <Cell key={i} fill={d.fill} opacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly growth % */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Monthly Revenue Growth % vs PY</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={cy2024} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `${v}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v > 0 ? '+' : ''}${v.toFixed(1)}%`, 'Growth']} />
              <Bar dataKey="growth" radius={[3, 3, 0, 0]}>
                {cy2024.map((d, i) => <Cell key={i} fill={d.growth >= 0 ? '#10B981' : '#EF4444'} opacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top brands + category scorecard */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Top Brands by Revenue — CY2024</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                <th className="pb-2 text-left font-medium">Brand</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">Volume</th>
              </tr>
            </thead>
            <tbody>
              {(perf?.top_brands ?? []).slice(0, 8).map((b, i) => (
                <tr key={b.brand} className="border-b border-border/50">
                  <td className="py-2 font-medium text-text-primary">
                    <span className="text-text-muted mr-2">{i + 1}</span>{b.brand}
                  </td>
                  <td className="py-2 text-right text-text-secondary">{fmtCurrency(b.revenue)}</td>
                  <td className="py-2 text-right text-text-muted">{fmtVolume(b.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Category Scorecard</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-text-muted uppercase tracking-wider">
                <th className="pb-2 text-left font-medium">Category</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">GM%</th>
                <th className="pb-2 text-right font-medium">Growth</th>
                <th className="pb-2 text-right font-medium">Share</th>
              </tr>
            </thead>
            <tbody>
              {(catPerf ?? []).map(c => (
                <tr key={c.category} className="border-b border-border/50">
                  <td className="py-2 font-medium text-text-primary flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: CATEGORY_COLORS[c.category] }} />
                    {c.category}
                  </td>
                  <td className="py-2 text-right text-text-secondary">{fmtCurrency(c.revenue)}</td>
                  <td className="py-2 text-right text-accent-green">{c.gm_pct.toFixed(1)}%</td>
                  <td className="py-2 text-right" style={{ color: c.rev_growth_pct >= 0 ? '#10B981' : '#EF4444' }}>
                    {fmtPct(c.rev_growth_pct)}
                  </td>
                  <td className="py-2 text-right text-text-muted">{c.rev_share_pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
