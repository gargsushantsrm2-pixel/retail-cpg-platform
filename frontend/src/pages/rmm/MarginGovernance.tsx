import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import PageHeader from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { Spinner } from '../../components/ui/Spinner'
import { useProducts } from '../../api/queries'
import {
  fetchMaturity, fetchSkuGovernor, fetchCommodityExposure, postCostToServe,
  postComplexity, postGuardrails,
} from '../../api/rmm'
import { CHART_STYLE, tooltipStyle } from '../../lib/chartTheme'
import { fmtCurrency } from '../../lib/utils'

const TABS = [
  { id: 'maturity', label: 'RGM Maturity' },
  { id: 'sku', label: 'SKU Governor' },
  { id: 'cts', label: 'Cost-to-Serve' },
  { id: 'guard', label: 'Pricing Guardrails' },
]
const inp = 'w-full text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent-blue'
const Field = ({ label, children }: any) => (<div><label className="label-xs block mb-1">{label}</label>{children}</div>)

export default function MarginGovernance() {
  return (
    <div className="animate-slide-in">
      <PageHeader title="Margin Governance"
        subtitle="Maturity diagnostics, SKU complexity governor, cost-to-serve, and pricing guardrails" />
      <Tabs tabs={TABS}>{(active) => (<>
        {active === 'maturity' && <Maturity />}
        {active === 'sku' && <SkuGov />}
        {active === 'cts' && <CostToServe />}
        {active === 'guard' && <Guardrails />}
      </>)}</Tabs>
    </div>
  )
}

function Maturity() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'maturity'], queryFn: fetchMaturity })
  if (isLoading || !data) return <Spinner />
  const d = data.data
  const dims = Object.entries(d.dimension_scores).map(([k, v]: any) => ({ dim: k.replace(/_/g, ' '), score: v }))
  return (
    <div className="grid xl:grid-cols-3 gap-4">
      <div className="card p-6 text-center" style={{ borderTop: '3px solid #8B5CF6' }}>
        <p className="label-xs mb-1">Overall RGM/RMM Maturity</p>
        <p className="text-5xl font-bold text-accent-purple">{d.overall_score}</p>
        <p className="text-sm font-semibold text-text-secondary mt-1">{d.stage}</p>
      </div>
      <div className="xl:col-span-2 card p-5">
        <h3 className="text-sm font-semibold mb-3">Capability Dimensions</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={dims} layout="vertical" margin={{ left: 30, right: 30 }}>
            <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="dim" width={130} tick={{ ...CHART_STYLE.tickStyle, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="score" radius={[0, 3, 3, 0]} label={{ position: 'right', fill: '#94A3B8', fontSize: 10 }}>
              {dims.map((d, i) => <Cell key={i} fill={d.score >= 70 ? '#10B981' : d.score >= 50 ? '#F59E0B' : '#EF4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="xl:col-span-3 card p-5">
        <h3 className="text-sm font-semibold mb-3">Step-Up Tasks</h3>
        <div className="space-y-2">
          {(d.step_up_tasks ?? []).map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-bg-elevated border border-border">
              <span className="px-2 py-0.5 rounded bg-accent-amber/15 text-accent-amber font-medium">{t.dimension} · {t.score}</span>
              <span className="text-text-secondary">{t.action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SkuGov() {
  const [floor, setFloor] = useState(40)
  const { data, isLoading, refetch } = useQuery({ queryKey: ['rmm', 'sku', floor], queryFn: () => fetchSkuGovernor(floor) })
  const recs = data?.data?.prune_candidates ?? []
  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-end gap-3">
        <Field label={`Margin floor: ${floor}%`}>
          <input type="range" min={10} max={60} value={floor} onChange={e => setFloor(+e.target.value)} onMouseUp={() => refetch()} className="w-64 accent-accent-blue" />
        </Field>
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">SKU Proliferation — Prune Candidates ({recs.length})</h3>
        {isLoading ? <Spinner /> : !recs.length ? <p className="text-xs text-text-muted">No SKUs below the floor — portfolio is healthy.</p> : (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
              {['SKU', 'Brand', 'Revenue', 'GM%', 'Volume'].map(h => <th key={h} className={`pb-2 font-medium ${h === 'SKU' ? 'text-left' : 'text-right'}`}>{h}</th>)}
            </tr></thead>
            <tbody>
              {recs.map((r: any) => (
                <tr key={r.product_id} className="border-b border-border/50">
                  <td className="py-2 text-text-primary">{r.sku_name?.slice(0, 36)}</td>
                  <td className="py-2 text-right text-text-secondary">{r.brand}</td>
                  <td className="py-2 text-right text-text-secondary">{fmtCurrency(r.revenue)}</td>
                  <td className="py-2 text-right text-accent-red">{r.gm_pct}%</td>
                  <td className="py-2 text-right text-text-secondary">{Math.round(r.volume)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function CostToServe() {
  const { data: products } = useProducts()
  const [pid, setPid] = useState('')
  const [cts, setCts] = useState(3.0)
  const [disc, setDisc] = useState(0.15)
  const mut = useMutation({ mutationFn: () =>
    postCostToServe({ product_id: pid, cost_to_serve_per_case: cts, promo_discount_pct: disc }) })
  const d = mut.data?.data
  return (
    <div className="grid xl:grid-cols-3 gap-4">
      <div className="card p-5 space-y-4">
        <Field label="Product">
          <select value={pid} onChange={e => setPid(e.target.value)} className={inp}>
            <option value="">— Select —</option>
            {(products ?? []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name?.slice(0, 40)}</option>)}
          </select>
        </Field>
        <Field label={`Cost-to-serve/case: $${cts.toFixed(2)}`}>
          <input type="range" min={0} max={15} step={0.5} value={cts} onChange={e => setCts(+e.target.value)} className="w-full accent-accent-blue" />
        </Field>
        <Field label={`Promo discount: ${(disc * 100).toFixed(0)}%`}>
          <input type="range" min={0} max={0.4} step={0.01} value={disc} onChange={e => setDisc(+e.target.value)} className="w-full accent-accent-blue" />
        </Field>
        <button onClick={() => pid && mut.mutate()} disabled={!pid || mut.isPending} className="btn-primary w-full disabled:opacity-50">Model Margin</button>
      </div>
      <div className="xl:col-span-2">
        {!d ? <div className="card p-10 text-center text-text-muted">Inject logistics cost and test promo profitability.</div> : (
          <div className="card p-6" style={{ borderTop: `3px solid ${d.block_recommendation ? '#EF4444' : '#10B981'}` }}>
            <p className="text-lg font-bold mb-3" style={{ color: d.block_recommendation ? '#EF4444' : '#10B981' }}>{d.verdict}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat k="Promo price" v={`$${d.promo_price}`} />
              <Stat k="Unit COGS" v={`$${d.unit_cogs}`} />
              <Stat k="GM excl. cost-to-serve" v={`${d.gross_margin_pct_excl_cts}%`} />
              <Stat k="GM incl. cost-to-serve" v={`${d.gross_margin_pct_incl_cts}%`} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Guardrails() {
  const [price, setPrice] = useState(60)
  const [baseline, setBaseline] = useState(38.40)
  const [comp, setComp] = useState(40)
  const [wtp, setWtp] = useState(0.97)
  const mut = useMutation({ mutationFn: () =>
    postGuardrails({ optimized_price: price, baseline_price: baseline, competitor_index_price: comp, wtp_correlation: wtp }) })
  const d = mut.data
  return (
    <div className="grid xl:grid-cols-3 gap-4">
      <div className="card p-5 space-y-4">
        <Field label={`Optimized price: $${price}`}><input type="range" min={20} max={80} value={price} onChange={e => setPrice(+e.target.value)} className="w-full accent-accent-blue" /></Field>
        <Field label={`Baseline price: $${baseline}`}><input type="range" min={20} max={80} step={0.5} value={baseline} onChange={e => setBaseline(+e.target.value)} className="w-full accent-accent-blue" /></Field>
        <Field label={`Competitor index: $${comp}`}><input type="range" min={20} max={80} value={comp} onChange={e => setComp(+e.target.value)} className="w-full accent-accent-blue" /></Field>
        <Field label={`WTP correlation: ${wtp.toFixed(2)}`}><input type="range" min={0.5} max={1} step={0.01} value={wtp} onChange={e => setWtp(+e.target.value)} className="w-full accent-accent-blue" /></Field>
        <button onClick={() => mut.mutate()} disabled={mut.isPending} className="btn-primary w-full disabled:opacity-50">Run Guardrail Chain</button>
      </div>
      <div className="xl:col-span-2">
        {!d ? <div className="card p-10 text-center text-text-muted">Run a proposed price through the guardrail chain (WTP 95% · competitor corridor · charm rounding).</div> : (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <span className={`text-lg font-bold ${d.allowed ? 'text-accent-green' : 'text-accent-red'}`}>
                {d.allowed ? '✓ Allowed' : '✗ Blocked → safe baseline'}
              </span>
              <span className="text-sm text-text-secondary">Final price: <span className="font-bold text-text-primary">${d.final_value}</span></span>
            </div>
            <div className="space-y-2">
              {d.results.map((r: any, i: number) => (
                <div key={i} className="flex items-start gap-3 text-xs p-2 rounded-lg bg-bg-elevated border border-border">
                  <span className={`px-2 py-0.5 rounded font-semibold shrink-0 ${
                    r.status === 'PASS' ? 'bg-accent-green/15 text-accent-green' :
                    r.status === 'BLOCK' ? 'bg-accent-red/15 text-accent-red' :
                    'bg-accent-amber/15 text-accent-amber'}`}>{r.status}</span>
                  <div>
                    <p className="text-text-primary font-medium">{r.gate}</p>
                    <p className="text-text-muted">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const Stat = ({ k, v }: any) => (
  <div className="p-3 rounded-lg bg-bg-elevated border border-border">
    <p className="label-xs mb-1">{k}</p><p className="text-sm font-semibold text-text-primary">{v}</p>
  </div>
)
