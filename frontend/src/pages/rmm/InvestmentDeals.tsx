import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import PageHeader from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { Spinner } from '../../components/ui/Spinner'
import { useProducts } from '../../api/queries'
import { fetchB2BPricer, fetchInvestOptimize, fetchDecisionGuides } from '../../api/rmm'
import { CHART_STYLE, tooltipStyle, PALETTE } from '../../lib/chartTheme'
import { fmtCurrency } from '../../lib/utils'

const TABS = [
  { id: 'b2b', label: 'B2B Deal Pricer' },
  { id: 'invest', label: 'Investment Optimizer' },
  { id: 'guides', label: 'Decision Guides' },
]
const inp = 'w-full text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary'

export default function InvestmentDeals() {
  return (
    <div className="animate-slide-in">
      <PageHeader title="Investment & Deals" subtitle="Modules 7/8 · decision guides, cross-lever investment optimizer, B2B win-probability pricer" />
      <Tabs tabs={TABS}>{(a) => (<>
        {a === 'b2b' && <B2B />}
        {a === 'invest' && <Invest />}
        {a === 'guides' && <Guides />}
      </>)}</Tabs>
    </div>
  )
}

function B2B() {
  const { data: products } = useProducts()
  const [pid, setPid] = useState('')
  const [vol, setVol] = useState(20000)
  const mut = useMutation({ mutationFn: () => fetchB2BPricer(pid, vol) })
  const d = mut.data?.data
  return (
    <div className="grid xl:grid-cols-4 gap-4">
      <div className="card p-5 space-y-4">
        <div><label className="label-xs block mb-1">Product</label><select value={pid} onChange={e => setPid(e.target.value)} className={inp}><option value="">— Select —</option>{(products ?? []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name?.slice(0, 30)}</option>)}</select></div>
        <div><label className="label-xs block mb-1">Committed volume: {vol.toLocaleString()}</label><input type="range" min={5000} max={100000} step={5000} value={vol} onChange={e => setVol(+e.target.value)} className="w-full accent-accent-blue" /></div>
        <button onClick={() => pid && mut.mutate()} disabled={!pid || mut.isPending} className="btn-primary w-full disabled:opacity-50">Optimize Deal</button>
      </div>
      <div className="xl:col-span-3">
        {!d ? <div className="card p-10 text-center text-text-muted">Find the discount maximizing win-probability × account value.</div> : (
          <>
            <div className="grid grid-cols-4 gap-3 mb-4">
              <Kpi label="Optimal Discount" value={`${d.optimal_discount_pct}%`} color="#3B82F6" />
              <Kpi label="Win Probability" value={d.win_probability_at_optimal} color="#10B981" />
              <Kpi label="Expected Value" value={fmtCurrency(d.expected_value_at_optimal)} color="#8B5CF6" />
              <Kpi label="Margin" value={`${d.margin_at_optimal_pct}%`} color="#F59E0B" />
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-3">Win Probability & Expected Value vs Discount</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={d.curve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid {...CHART_STYLE.grid} />
                  <XAxis dataKey="discount_pct" tickFormatter={(v: number) => `${v}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="l" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="r" orientation="right" tickFormatter={(v: number) => v.toFixed(1)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line yAxisId="r" type="monotone" dataKey="win_probability" stroke="#10B981" strokeWidth={2} dot={false} name="Win prob" />
                  <Line yAxisId="l" type="monotone" dataKey="expected_value" stroke="#8B5CF6" strokeWidth={2.5} dot={false} name="Expected value" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Invest() {
  const [budget, setBudget] = useState(1000000)
  const { data, isLoading, refetch } = useQuery({ queryKey: ['rmm', 'invest', budget], queryFn: () => fetchInvestOptimize(budget) })
  const d = data?.data
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-4">
        <label className="label-xs">Budget: {fmtCurrency(budget)}</label>
        <input type="range" min={250000} max={5000000} step={250000} value={budget} onChange={e => setBudget(+e.target.value)} onMouseUp={() => refetch()} className="w-64 accent-accent-blue" />
        {d && <span className="ml-auto text-sm">Projected return: <span className="font-bold text-accent-green">{fmtCurrency(d.projected_total_return)}</span> ({d.roi_multiple}×)</span>}
      </div>
      {isLoading || !d ? <Spinner /> : (
        <div className="grid xl:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">Optimal Allocation</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.allocation} layout="vertical" margin={{ left: 30, right: 40 }}>
                <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="lever" width={120} tick={{ ...CHART_STYLE.tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                <Bar dataKey="allocation" radius={[0, 3, 3, 0]}>{d.allocation.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">Lever Detail</h3>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider"><th className="pb-2 text-left font-medium">Lever</th><th className="pb-2 text-right font-medium">Allocation</th><th className="pb-2 text-right font-medium">%</th><th className="pb-2 text-right font-medium">Return</th></tr></thead>
              <tbody>{d.allocation.map((r: any) => (
                <tr key={r.lever} className="border-b border-border/50">
                  <td className="py-2 text-text-primary">{r.lever}</td>
                  <td className="py-2 text-right text-text-secondary">{fmtCurrency(r.allocation)}</td>
                  <td className="py-2 text-right text-accent-blue">{r.allocation_pct}%</td>
                  <td className="py-2 text-right text-accent-green">{fmtCurrency(r.projected_return)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function Guides() {
  const [spike, setSpike] = useState(4)
  const { data, isLoading, refetch } = useQuery({ queryKey: ['rmm', 'guides', spike], queryFn: () => fetchDecisionGuides(spike) })
  const guides = data?.data?.guides ?? []
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center gap-4">
        <label className="label-xs">Raw-material cost spike: {spike}%</label>
        <input type="range" min={1} max={20} value={spike} onChange={e => setSpike(+e.target.value)} onMouseUp={() => refetch()} className="w-64 accent-accent-blue" />
      </div>
      {isLoading ? <Spinner /> : (
        <div className="grid xl:grid-cols-3 gap-4">
          {guides.map((g: any) => (
            <div key={g.product_id} className="card p-5" style={{ borderTop: '3px solid #F97316' }}>
              <h3 className="text-sm font-semibold mb-1">{g.sku_name?.slice(0, 30)}</h3>
              <p className="label-xs mb-2">current GM {g.current_gm_pct}% · trigger: {g.trigger}</p>
              <ul className="space-y-1.5">
                {g.actions.map((a: string, i: number) => <li key={i} className="text-xs text-text-secondary flex gap-2"><span className="text-accent-orange">▸</span>{a}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const Kpi = ({ label, value, color }: any) => (
  <div className="card-elevated p-3 text-center" style={{ borderTop: `3px solid ${color}` }}>
    <p className="label-xs mb-1">{label}</p><p className="text-lg font-bold" style={{ color }}>{value}</p>
  </div>
)
