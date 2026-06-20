import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import PageHeader from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useProducts } from '../../api/queries'
import { fetchAgentSim, fetchWtpDist, postSurveyCalibration } from '../../api/rmm'
import { CHART_STYLE, tooltipStyle, PALETTE } from '../../lib/chartTheme'

const TABS = [
  { id: 'agent', label: 'Agent-Based Shopper Sim' },
  { id: 'wtp', label: 'Raw WTP Distribution' },
  { id: 'survey', label: 'Survey Calibration' },
]
const CATS = ['Beverages', 'Snacks', 'Personal Care', 'Household', 'Dairy']
const inp = 'w-full text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent-blue'
const Field = ({ label, children }: any) => (<div><label className="label-xs block mb-1">{label}</label>{children}</div>)
const Empty = ({ msg }: any) => (<div className="card p-10 text-center text-text-muted">{msg}</div>)

export default function ConsumerScience() {
  return (
    <div className="animate-slide-in">
      <PageHeader title="Consumer Science" subtitle="Modules 11–13 · agent-based simulation, raw WTP distribution, survey calibration" />
      <Tabs tabs={TABS}>{(a) => (<>
        {a === 'agent' && <AgentSim />}
        {a === 'wtp' && <Wtp />}
        {a === 'survey' && <Survey />}
      </>)}</Tabs>
    </div>
  )
}

function AgentSim() {
  const { data: products } = useProducts()
  const [cat, setCat] = useState('Beverages')
  const [shock, setShock] = useState('')
  const mut = useMutation({ mutationFn: () => fetchAgentSim(cat, shock || undefined, 10) })
  const d = mut.data?.data
  const skuProducts = (products ?? []).filter((p: any) => p.category === cat)
  return (
    <div className="grid xl:grid-cols-4 gap-4">
      <div className="card p-5 space-y-4">
        <Field label="Category"><select value={cat} onChange={e => { setCat(e.target.value); setShock('') }} className={inp}>{CATS.map(c => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Price-shock SKU (optional)"><select value={shock} onChange={e => setShock(e.target.value)} className={inp}><option value="">— none —</option>{skuProducts.map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name?.slice(0, 32)}</option>)}</select></Field>
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary w-full disabled:opacity-50">{mut.isPending ? 'Simulating…' : 'Run 3,000 agents'}</button>
      </div>
      <div className="xl:col-span-3 space-y-4">
        {!d ? <Empty msg="Run the agent-based shelf simulation." /> : (<>
          <div className="grid grid-cols-2 gap-4">
            <div className="card-elevated p-4 text-center" style={{ borderTop: '3px solid #EF4444' }}>
              <p className="label-xs mb-1">No-Purchase Share</p>
              <p className="text-3xl font-bold text-accent-red">{(d.no_purchase_share * 100).toFixed(1)}%</p>
            </div>
            <div className="card-elevated p-4 text-center" style={{ borderTop: '3px solid #3B82F6' }}>
              <p className="label-xs mb-1">Agents</p>
              <p className="text-3xl font-bold text-accent-blue">{d.n_agents.toLocaleString()}</p>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">Predicted Shelf Share</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.skus} layout="vertical" margin={{ left: 20, right: 40 }}>
                <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="sku_name" width={150} tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: string) => v.slice(0, 22)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                <Bar dataKey="share" radius={[0, 3, 3, 0]}>{d.skus.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {d.substitution && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-2">Substitution on +{d.substitution.shock_pct}% price shock</h3>
              <p className="text-xs text-text-secondary mb-2">Lost <span className="text-accent-red font-bold">{(d.substitution.share_lost * 100).toFixed(1)}%</span> share · to no-purchase {(d.substitution.to_no_purchase * 100).toFixed(1)}%</p>
              {(d.substitution.to_competitors ?? []).map((r: any) => (
                <div key={r.product_id} className="flex justify-between text-xs py-1 border-b border-border/40">
                  <span className="text-text-secondary">{r.sku_name?.slice(0, 30)}</span><span className="text-accent-green">+{(r.share_gain * 100).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          )}
        </>)}
      </div>
    </div>
  )
}

function Wtp() {
  const { data: products } = useProducts()
  const [pid, setPid] = useState('')
  const mut = useMutation({ mutationFn: () => fetchWtpDist(pid) })
  const d = mut.data?.data
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-end gap-3">
        <Field label="Product"><select value={pid} onChange={e => setPid(e.target.value)} className={`${inp} max-w-md`}><option value="">— Select —</option>{(products ?? []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name}</option>)}</select></Field>
        <button onClick={() => pid && mut.mutate()} disabled={!pid || mut.isPending} className="btn-primary disabled:opacity-50">Plot Distribution</button>
      </div>
      {!d ? <Empty msg="The anti-aggregation engine plots the continuous WTP distribution, not a single average." /> : (
        <div className="grid xl:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-1">WTP Distribution — {d.sku_name}</h3>
            <p className="label-xs mb-3">mean ${d.mean_wtp} · median ${d.median_wtp} · avg price ${d.avg_price}</p>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={d.histogram} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                <XAxis dataKey="price" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                <YAxis tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#8B5CF6" opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">Demand Curve + Drop-off Cliffs</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={d.demand_curve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid {...CHART_STYLE.grid} />
                <XAxis dataKey="price" tick={{ ...CHART_STYLE.tickStyle, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
                <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
                <Line type="monotone" dataKey="share" stroke="#06B6D4" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 flex flex-wrap gap-2">
              {(d.drop_off_cliffs ?? []).map((c: any, i: number) => (
                <span key={i} className="px-2 py-1 rounded bg-accent-red/15 text-accent-red text-xs">cliff @ ${c.price} (−{(c.share_lost * 100).toFixed(1)}%)</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Survey() {
  const [data, setData] = useState<any>(null)
  const sample = [
    { price: 20, pct_would_buy: 95 }, { price: 30, pct_would_buy: 82 }, { price: 40, pct_would_buy: 60 },
    { price: 50, pct_would_buy: 38 }, { price: 60, pct_would_buy: 18 }, { price: 70, pct_would_buy: 6 },
  ]
  const mut = useMutation({ mutationFn: () => postSurveyCalibration(sample), onSuccess: (r: any) => setData(r.data) })
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-center justify-between">
        <p className="text-xs text-text-secondary">Sample survey: "would you buy at $X?" — calibrated from "buy or nothing" to realistic shelf choice.</p>
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary disabled:opacity-50">Calibrate</button>
      </div>
      {data && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-1">Raw vs Calibrated Demand</h3>
          <p className="label-xs mb-3">avg realism gap: {(data.avg_realism_gap * 100).toFixed(1)} pts</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.curve} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid {...CHART_STYLE.grid} />
              <XAxis dataKey="price" tickFormatter={(v: number) => `$${v}`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${(v * 100).toFixed(1)}%`} />
              <Line type="monotone" dataKey="raw_intent" stroke="#EF4444" strokeWidth={2} dot name="Raw (buy-or-nothing)" />
              <Line type="monotone" dataKey="calibrated" stroke="#10B981" strokeWidth={2.5} dot name="Calibrated (shelf)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
