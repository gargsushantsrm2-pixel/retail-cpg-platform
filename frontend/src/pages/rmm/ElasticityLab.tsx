import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer,
} from 'recharts'
import PageHeader from '../../components/ui/PageHeader'
import { Tabs } from '../../components/ui/Tabs'
import { useProducts } from '../../api/queries'
import { postContextMatrix, postCannibalization } from '../../api/rmm'
import { CHART_STYLE, tooltipStyle } from '../../lib/chartTheme'

const TABS = [{ id: 'context', label: 'Context Elasticity Matrix' }, { id: 'cannib', label: 'Cannibalization' }]

export default function ElasticityLab() {
  const { data: products } = useProducts()
  const [pid, setPid] = useState('')
  const ctx = useMutation({ mutationFn: () => postContextMatrix(pid) })
  const can = useMutation({ mutationFn: () => postCannibalization(pid, 5) })

  const run = () => { if (pid) { ctx.mutate(); can.mutate() } }

  const selector = (
    <div className="card p-4 mb-4 flex items-end gap-3">
      <div className="flex-1 max-w-md">
        <label className="label-xs block mb-1">Product</label>
        <select value={pid} onChange={e => setPid(e.target.value)}
          className="w-full text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-secondary outline-none focus:border-accent-blue">
          <option value="">— Select SKU —</option>
          {(products ?? []).map((p: any) => <option key={p.product_id} value={p.product_id}>{p.sku_name}</option>)}
        </select>
      </div>
      <button onClick={run} disabled={!pid || ctx.isPending} className="btn-primary disabled:opacity-50">
        {ctx.isPending ? 'Running…' : 'Analyze'}
      </button>
    </div>
  )

  const cm = ctx.data?.data
  const matrixData = cm ? Object.entries(cm.context_matrix).map(([k, v]: any) => ({
    context: k.replace('_', ' '), elasticity: v.elasticity, safe: v.safe_baseline, r2: v.r_squared,
  })) : []
  const cd = can.data?.data

  return (
    <div className="animate-slide-in">
      <PageHeader title="Dynamic Elasticity Lab"
        subtitle="Module 1 & 10 · context-dependent elasticity, non-linear demand core, portfolio cannibalization" />
      {selector}

      <Tabs tabs={TABS}>{(active) => (<>
        {active === 'context' && (
          !cm ? <Empty /> : (
            <div className="grid xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2 card p-5">
                <h3 className="text-sm font-semibold mb-1">{cm.sku_name}</h3>
                <p className="label-xs mb-4">Elasticity across 4 contexts (Module 22)</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={matrixData} layout="vertical" margin={{ left: 20, right: 40 }}>
                    <CartesianGrid {...CHART_STYLE.grid} horizontal={false} />
                    <XAxis type="number" tick={CHART_STYLE.tickStyle} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="context" width={110}
                      tick={{ ...CHART_STYLE.tickStyle, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle}
                      formatter={(v: number, _n, p: any) => [`${v}${p.payload.safe ? ' (baseline)' : ''}`, 'elasticity']} />
                    <Bar dataKey="elasticity" radius={[0, 3, 3, 0]}
                      label={{ position: 'right', fill: '#94A3B8', fontSize: 10 }}>
                      {matrixData.map((d, i) => (
                        <Cell key={i} fill={d.safe ? '#475569' : d.elasticity > -2 ? '#10B981' : d.elasticity > -3 ? '#F59E0B' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-3">Non-Linear Demand Core</h3>
                {cm.non_linear_demand?.safe_baseline ? (
                  <p className="text-xs text-text-muted">Insufficient price variation — defaulting to constant gross-margin rule.</p>
                ) : (
                  <div className="space-y-3 text-xs">
                    <Row k="Linear fit R²" v={cm.non_linear_demand?.linear_fit?.r_squared} />
                    <Row k="Power fit R²" v={cm.non_linear_demand?.power_fit?.r_squared} />
                    <div className="p-3 rounded-lg bg-bg-elevated border border-border">
                      <p className="label-xs mb-1">Recommended pass-through rule</p>
                      <p className="text-sm font-semibold text-accent-purple">
                        {cm.non_linear_demand?.recommended_rule === 'half_cost_absolute_passthrough'
                          ? 'Half-cost absolute pass-through' : 'Constant gross-margin %'}
                      </p>
                      <p className="text-text-muted mt-1">{cm.non_linear_demand?.note}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        )}
        {active === 'cannib' && (
          !cd ? <Empty /> : (
            <div className="grid xl:grid-cols-3 gap-4">
              <div className="card p-5 text-center" style={{ borderTop: '3px solid #10B981' }}>
                <p className="label-xs mb-1">Own-Portfolio Recapture</p>
                <p className="text-4xl font-bold text-accent-green">{cd.own_portfolio_recapture_pct}%</p>
                <p className="text-xs text-text-muted mt-1">volume kept in portfolio on +{cd.price_change_pct}% price</p>
              </div>
              <div className="card p-5 text-center" style={{ borderTop: '3px solid #EF4444' }}>
                <p className="label-xs mb-1">Competitor Leakage</p>
                <p className="text-4xl font-bold text-accent-red">{cd.competitor_leakage_pct}%</p>
                <p className="text-xs text-text-muted mt-1">volume lost outside the portfolio</p>
              </div>
              <div className="card p-5">
                <h3 className="text-sm font-semibold mb-2">Top Recipients</h3>
                <div className="space-y-1.5">
                  {(cd.top_recipients ?? []).map((r: any) => (
                    <div key={r.product_id} className="flex justify-between text-xs py-1 border-b border-border/40">
                      <span className="text-text-secondary truncate">{r.sku_name?.slice(0, 28)}</span>
                      <span className={r.same_brand ? 'text-accent-green' : 'text-accent-amber'}>
                        {r.cross_corr > 0 ? '+' : ''}{r.cross_corr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        )}
      </>)}</Tabs>
    </div>
  )
}

const Empty = () => (
  <div className="card p-10 text-center text-text-muted">Select a SKU and click Analyze.</div>
)
const Row = ({ k, v }: { k: string; v: any }) => (
  <div className="flex justify-between"><span className="text-text-muted">{k}</span><span className="text-text-secondary font-medium">{v ?? '—'}</span></div>
)
