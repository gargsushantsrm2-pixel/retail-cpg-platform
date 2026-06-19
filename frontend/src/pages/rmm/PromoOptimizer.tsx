import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import PageHeader from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useProducts } from '../../api/queries'
import {
  postPromoSim, postPostEventROI, fetchCalendar, createCalendarEvent, deleteCalendarEvent,
} from '../../api/rmm'
import { CHART_STYLE, tooltipStyle } from '../../lib/chartTheme'
import { fmtCurrency } from '../../lib/utils'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'sim', label: 'Pre-Event Simulator' },
  { id: 'post', label: 'Post-Event ROI' },
  { id: 'cal', label: 'Promo Calendar' },
]
const PROMO_TYPES = ['TPR', 'Display', 'Feature', 'Display+Feature', 'Display+Feature+TPR']

export default function PromoOptimizer() {
  const { data: products } = useProducts()
  const [pid, setPid] = useState('')
  const [ptype, setPtype] = useState('Display+Feature')
  const [disc, setDisc] = useState(0.15)
  const [dur, setDur] = useState(4)
  const [display, setDisplay] = useState(true)
  const [feature, setFeature] = useState(true)

  const sim = useMutation({ mutationFn: () =>
    postPromoSim({ product_id: pid, promo_type: ptype, discount_pct: disc, duration_weeks: dur, display, feature }),
    onError: () => toast.error('Simulation failed') })
  const post = useMutation({ mutationFn: () => postPostEventROI(pid || undefined) })

  const d = sim.data?.data

  return (
    <div className="animate-slide-in">
      <PageHeader title="Promotion Optimizer (TPM/TPO)"
        subtitle="Module 2 · pre-event lift simulation, post-event balanced ROI, multi-week calendar with liability" />

      <Tabs tabs={TABS}>{(active) => (<>
        {active === 'sim' && (
          <div className="grid xl:grid-cols-4 gap-4">
            <div className="card p-5 space-y-4">
              <h3 className="text-sm font-semibold">Promo Inputs</h3>
              <Field label="Product">
                <select value={pid} onChange={e => setPid(e.target.value)} className={inp}>
                  <option value="">— Select —</option>
                  {(products ?? []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name?.slice(0, 40)}</option>)}
                </select>
              </Field>
              <Field label="Promo type">
                <select value={ptype} onChange={e => setPtype(e.target.value)} className={inp}>
                  {PROMO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label={`Discount: ${(disc * 100).toFixed(0)}%`}>
                <input type="range" min={0.05} max={0.40} step={0.01} value={disc}
                  onChange={e => setDisc(+e.target.value)} className="w-full accent-accent-blue" />
              </Field>
              <Field label={`Duration: ${dur} weeks`}>
                <input type="range" min={1} max={12} value={dur} onChange={e => setDur(+e.target.value)} className="w-full accent-accent-blue" />
              </Field>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input type="checkbox" checked={display} onChange={e => setDisplay(e.target.checked)} className="accent-accent-blue" /> Display
                </label>
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input type="checkbox" checked={feature} onChange={e => setFeature(e.target.checked)} className="accent-accent-blue" /> Feature
                </label>
              </div>
              <button onClick={() => pid && sim.mutate()} disabled={!pid || sim.isPending} className="btn-primary w-full disabled:opacity-50">
                {sim.isPending ? 'Simulating…' : 'Simulate'}
              </button>
            </div>
            <div className="xl:col-span-3 space-y-4">
              {!d ? <Empty msg="Select a product and simulate a promotion." /> : (<>
                <div className="grid grid-cols-4 gap-3">
                  <Kpi label="Predicted Lift" value={`${d.predicted_lift_pct}%`} color="#3B82F6" />
                  <Kpi label="Incremental Rev" value={fmtCurrency(d.incremental_revenue)} color="#10B981" />
                  <Kpi label="Trade Spend" value={fmtCurrency(d.trade_spend)} color="#EF4444" />
                  <Kpi label="Company ROI" value={`${d.company.roi_pct}%`} color={d.company.roi_pct >= 0 ? '#10B981' : '#EF4444'} />
                </div>
                <div className="grid xl:grid-cols-2 gap-4">
                  <div className="card p-5">
                    <h3 className="text-sm font-semibold mb-3">Company vs Retailer</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={[
                        { k: 'Net Profit', v: d.company.net_profit },
                        { k: 'Incr. GP', v: d.company.incremental_gross_profit },
                        { k: 'Trade Spend', v: -d.trade_spend },
                      ]} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid {...CHART_STYLE.grid} vertical={false} />
                        <XAxis dataKey="k" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={v => fmtCurrency(v)} tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                        <Bar dataKey="v" radius={[3, 3, 0, 0]}>
                          {[d.company.net_profit, d.company.incremental_gross_profit, -d.trade_spend].map((v, i) =>
                            <Cell key={i} fill={v >= 0 ? '#10B981' : '#EF4444'} opacity={0.85} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="card p-5 space-y-2">
                    <h3 className="text-sm font-semibold mb-2">Retailer View</h3>
                    <Row k="Shelf price" v={`$${d.retailer.shelf_price}`} />
                    <Row k="Promo shelf price" v={`$${d.retailer.promo_shelf_price}`} />
                    <Row k="Retailer gross margin" v={`${d.retailer.gross_margin_pct}%`} />
                    <Row k="Baseline weekly vol" v={Math.round(d.baseline_weekly_volume)} />
                    <Row k="Incremental vol" v={Math.round(d.incremental_volume)} />
                  </div>
                </div>
              </>)}
            </div>
          </div>
        )}

        {active === 'post' && (
          <div className="space-y-4">
            <button onClick={() => post.mutate()} disabled={post.isPending} className="btn-primary disabled:opacity-50">
              {post.isPending ? 'Loading…' : 'Load Post-Event ROI'}
            </button>
            {post.data?.data?.by_promo_type && (
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-3">Baseline-Stripped ROI by Promo Type</h3>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
                    {['Promo Type', 'Events', 'Realized Lift', 'Incr. Rev', 'Trade Spend', 'Company ROI', 'Retailer GM'].map(h =>
                      <th key={h} className={`pb-2 font-medium ${h === 'Promo Type' ? 'text-left' : 'text-right'}`}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {post.data.data.by_promo_type.map((r: any) => (
                      <tr key={r.promo_type} className="border-b border-border/50">
                        <td className="py-2 text-text-primary font-medium">{r.promo_type}</td>
                        <td className="py-2 text-right text-text-secondary">{r.events}</td>
                        <td className="py-2 text-right text-text-secondary">{r.realized_lift_pct}%</td>
                        <td className="py-2 text-right text-text-secondary">{fmtCurrency(r.incremental_revenue)}</td>
                        <td className="py-2 text-right text-accent-red">{fmtCurrency(r.trade_spend)}</td>
                        <td className="py-2 text-right font-semibold" style={{ color: r.company_roi_pct >= 0 ? '#10B981' : '#EF4444' }}>{r.company_roi_pct}%</td>
                        <td className="py-2 text-right text-accent-amber">{r.retailer_gross_margin_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {active === 'cal' && <CalendarTab products={products} />}
      </>)}</Tabs>
    </div>
  )
}

function CalendarTab({ products }: { products: any }) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['rmm', 'calendar'], queryFn: fetchCalendar })
  const [pid, setPid] = useState('')
  const [start, setStart] = useState('2025-03-03')
  const create = useMutation({
    mutationFn: () => createCalendarEvent({ product_id: pid, start_week: start, duration_weeks: 2, promo_type: 'Feature', discount_pct: 0.10, feature: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rmm', 'calendar'] }); toast.success('Promo scheduled') },
  })
  const del = useMutation({
    mutationFn: (id: number) => deleteCalendarEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rmm', 'calendar'] }),
  })

  return (
    <div className="space-y-4">
      <div className="card p-4 flex items-end gap-3 flex-wrap">
        <Field label="Product">
          <select value={pid} onChange={e => setPid(e.target.value)} className={inp}>
            <option value="">— Select —</option>
            {(products ?? []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name?.slice(0, 35)}</option>)}
          </select>
        </Field>
        <Field label="Start week">
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className={inp} />
        </Field>
        <button onClick={() => pid && create.mutate()} disabled={!pid || create.isPending} className="btn-primary disabled:opacity-50">Schedule Promo</button>
        {data && <span className="ml-auto text-sm text-text-secondary">Total liability: <span className="font-bold text-accent-amber">{fmtCurrency(data.total_trade_liability)}</span></span>}
      </div>
      <div className="card p-5">
        <h3 className="text-sm font-semibold mb-3">Scheduled Promotions ({data?.count ?? 0})</h3>
        {!data?.events?.length ? <p className="text-xs text-text-muted">No promotions scheduled.</p> : (
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border text-text-muted uppercase tracking-wider">
              {['Product', 'Window', 'Type', 'Disc', 'Lift', 'Liability', ''].map(h => <th key={h} className="pb-2 text-left font-medium">{h}</th>)}
            </tr></thead>
            <tbody>
              {data.events.map((e: any) => (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="py-2 text-text-primary">{e.product_id}</td>
                  <td className="py-2 text-text-secondary">{e.start_week} → {e.end_week}</td>
                  <td className="py-2 text-text-secondary">{e.promo_type}</td>
                  <td className="py-2 text-text-secondary">{(e.discount_pct * 100).toFixed(0)}%</td>
                  <td className="py-2 text-text-secondary">{e.predicted_lift_pct}%</td>
                  <td className="py-2 text-accent-amber">{fmtCurrency(e.trade_liability)}</td>
                  <td className="py-2"><button onClick={() => del.mutate(e.id)} className="text-accent-red hover:underline">delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const inp = 'w-full text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent-blue'
const Field = ({ label, children }: any) => (<div><label className="label-xs block mb-1">{label}</label>{children}</div>)
const Kpi = ({ label, value, color }: any) => (
  <div className="card-elevated p-3 text-center" style={{ borderTop: `3px solid ${color}` }}>
    <p className="label-xs mb-1">{label}</p><p className="text-lg font-bold" style={{ color }}>{value}</p>
  </div>
)
const Row = ({ k, v }: any) => (<div className="flex justify-between text-xs py-1 border-b border-border/40"><span className="text-text-muted">{k}</span><span className="text-text-secondary font-medium">{v}</span></div>)
const Empty = ({ msg }: any) => (<div className="card p-10 text-center text-text-muted">{msg}</div>)
