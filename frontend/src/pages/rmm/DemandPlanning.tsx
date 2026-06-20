import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import PageHeader from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { Spinner } from '../../components/ui/Spinner'
import { useProducts } from '../../api/queries'
import {
  fetchAssortment, fetchForecastDisruption, fetchSegmented, fetchPromoTiming,
} from '../../api/rmm'
import { CHART_STYLE, tooltipStyle } from '../../lib/chartTheme'
import { fmtCurrency } from '../../lib/utils'

const TABS = [
  { id: 'assort', label: 'Store Assortment' },
  { id: 'forecast', label: 'Forecast + Disruption' },
  { id: 'seg', label: 'Segmented Demand' },
  { id: 'timing', label: 'Promo Timing' },
]
const CATS = ['Beverages', 'Snacks', 'Personal Care', 'Household', 'Dairy']
const inp = 'text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary'

export default function DemandPlanning() {
  return (
    <div className="animate-slide-in">
      <PageHeader title="Demand & Assortment" subtitle="Modules 5/9 · store assortment, ML forecast with disruption, segmented response, promo timing" />
      <Tabs tabs={TABS}>{(a) => (<>
        {a === 'assort' && <Assort />}
        {a === 'forecast' && <Forecast />}
        {a === 'seg' && <Segmented />}
        {a === 'timing' && <Timing />}
      </>)}</Tabs>
    </div>
  )
}

function Assort() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'assort'], queryFn: () => fetchAssortment() })
  if (isLoading) return <Spinner />
  const rows = data?.data?.delist_candidates ?? []
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold mb-3">Slow-Moving SKU Placements — Delist Review ({rows.length})</h3>
      {!rows.length ? <p className="text-xs text-text-muted">No slow movers flagged.</p> : (
        <table className="w-full text-xs">
          <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
            {['Customer', 'SKU', 'Category', 'Weekly Velocity', 'Revenue'].map(h => <th key={h} className={`pb-2 font-medium ${h === 'Customer' || h === 'SKU' ? 'text-left' : 'text-right'}`}>{h}</th>)}
          </tr></thead>
          <tbody>{rows.map((r: any, i: number) => (
            <tr key={i} className="border-b border-border/50">
              <td className="py-2 text-text-secondary">{r.customer_name?.replace(" / Sam's Club", '')}</td>
              <td className="py-2 text-text-primary">{r.sku_name?.slice(0, 28)}</td>
              <td className="py-2 text-text-secondary">{r.category}</td>
              <td className="py-2 text-right text-accent-amber">{r.weekly_velocity}</td>
              <td className="py-2 text-right text-text-secondary">{fmtCurrency(r.revenue)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}

function Forecast() {
  const { data: products } = useProducts()
  const [pid, setPid] = useState('')
  const [infl, setInfl] = useState(4)
  const [supply, setSupply] = useState(0)
  const mut = useMutation({ mutationFn: () => fetchForecastDisruption(pid || undefined, infl, supply) })
  const d = mut.data?.data
  return (
    <div className="grid xl:grid-cols-4 gap-4">
      <div className="card p-5 space-y-4">
        <div><label className="label-xs block mb-1">Product (optional)</label><select value={pid} onChange={e => setPid(e.target.value)} className={`${inp} w-full`}><option value="">All</option>{(products ?? []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name?.slice(0, 30)}</option>)}</select></div>
        <div><label className="label-xs block mb-1">Inflation: {infl}%</label><input type="range" min={0} max={15} value={infl} onChange={e => setInfl(+e.target.value)} className="w-full accent-accent-blue" /></div>
        <div><label className="label-xs block mb-1">Supply bottleneck: {supply}%</label><input type="range" min={0} max={50} value={supply} onChange={e => setSupply(+e.target.value)} className="w-full accent-accent-blue" /></div>
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary w-full disabled:opacity-50">Apply Disruption</button>
      </div>
      <div className="xl:col-span-3">
        {!d ? <div className="card p-10 text-center text-text-muted">Overlay macro disruption indicators on the demand forecast.</div> : (
          <div className="card p-5">
            <div className="flex gap-6 mb-3">
              <div><p className="label-xs">Base units</p><p className="text-lg font-bold text-text-primary">{Math.round(d.total_base_units).toLocaleString()}</p></div>
              <div><p className="label-xs">Adjusted units</p><p className="text-lg font-bold text-accent-amber">{Math.round(d.total_adjusted_units).toLocaleString()}</p></div>
              <div><p className="label-xs">Demand factor</p><p className="text-lg font-bold text-accent-cyan">{d.demand_adjustment_factor}</p></div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={d.weekly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid {...CHART_STYLE.grid} />
                <XAxis dataKey="week_date" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="base_forecast" stroke="#3B82F6" strokeWidth={2} dot={false} name="Base" />
                <Line type="monotone" dataKey="disruption_adjusted" stroke="#F59E0B" strokeWidth={2.5} dot={false} name="Disruption-adjusted" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

function Segmented() {
  const [pc, setPc] = useState(5)
  const { data, isLoading, refetch } = useQuery({ queryKey: ['rmm', 'seg', pc], queryFn: () => fetchSegmented(pc) })
  const d = data?.data
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-4">
        <label className="label-xs">Price change: {pc}%</label>
        <input type="range" min={-20} max={20} value={pc} onChange={e => setPc(+e.target.value)} onMouseUp={() => refetch()} className="w-64 accent-accent-blue" />
        {d && <span className="ml-auto text-sm">Blended vol Δ: <span className="font-bold" style={{ color: d.blended_volume_change_pct >= 0 ? '#10B981' : '#EF4444' }}>{d.blended_volume_change_pct}%</span></span>}
      </div>
      {isLoading || !d ? <Spinner /> : (
        <div className="grid xl:grid-cols-3 gap-4">
          {d.segments.map((s: any) => (
            <div key={s.segment} className="card p-5">
              <h3 className="text-sm font-semibold mb-1">{s.segment}</h3>
              <p className="label-xs mb-2">share {(s.share * 100).toFixed(0)}% · elasticity {s.elasticity}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-text-muted">Volume change</span><span style={{ color: s.volume_change_pct >= 0 ? '#10B981' : '#EF4444' }}>{s.volume_change_pct}%</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Switch to competitor</span><span className="text-accent-amber">{s.switch_to_competitor_pct}%</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Drop out of category</span><span className="text-accent-red">{s.drop_out_pct}%</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Timing() {
  const [cat, setCat] = useState('Beverages')
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'timing', cat], queryFn: () => fetchPromoTiming(cat) })
  const d = data?.data
  return (
    <div className="space-y-4">
      <div className="card p-4"><select value={cat} onChange={e => setCat(e.target.value)} className={inp}>{CATS.map(c => <option key={c}>{c}</option>)}</select></div>
      {isLoading || !d ? <Spinner /> : (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">Demand Seasonality — {cat}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={d.seasonality} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="month" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="index" radius={[3, 3, 0, 0]}>
                {d.seasonality.map((s: any, i: number) => <Cell key={i} fill={s.index >= 1.1 ? '#EF4444' : s.index <= 0.92 ? '#10B981' : '#475569'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs text-text-muted">Promote (troughs):</span>
            {d.recommended_promo_windows.map((m: string) => <span key={m} className="px-2 py-0.5 rounded bg-accent-green/15 text-accent-green text-xs">{m}</span>)}
            <span className="text-xs text-text-muted ml-3">Avoid (peaks):</span>
            {d.natural_peaks_avoid_promo.map((m: string) => <span key={m} className="px-2 py-0.5 rounded bg-accent-red/15 text-accent-red text-xs">{m}</span>)}
          </div>
        </div>
      )}
    </div>
  )
}
