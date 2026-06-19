import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer,
} from 'recharts'
import PageHeader from '../../components/ui/PageHeader'
import { postThreeC, type ThreeCInput } from '../../api/rmm'
import { tooltipStyle } from '../../lib/chartTheme'
import toast from 'react-hot-toast'

const RATING_COLOR: Record<string, string> = { GREEN: '#10B981', AMBER: '#F59E0B', RED: '#EF4444' }

export default function ThreeCScorecard() {
  const [form, setForm] = useState<ThreeCInput>({
    company_unit_price: 38.40, company_unit_cost: 22.10, company_target_margin: 0.35,
    retail_shelf_price: 52.00, retailer_margin_floor: 0.25,
    wtp_median: 50.0, wtp_p90: 60.0,
  })
  const mut = useMutation({ mutationFn: postThreeC,
    onError: () => toast.error('Scoring failed') })

  const set = (k: keyof ThreeCInput, v: number) => setForm(f => ({ ...f, [k]: v }))
  const run = () => mut.mutate(form)
  const res = mut.data

  const radar = res ? [
    { axis: 'Company', score: res.axes.company.score },
    { axis: 'Customer', score: res.axes.customer.score },
    { axis: 'Consumer', score: res.axes.consumer.score },
  ] : []

  return (
    <div className="animate-slide-in">
      <PageHeader title="3-C Joint Optimization Scorecard"
        subtitle="Module 19 · balance Company margin, Customer (retailer) margin, and Consumer WTP simultaneously" />

      <div className="grid xl:grid-cols-3 gap-4">
        {/* Inputs */}
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold">Proposed Action</h3>
          {([
            ['Company net price ($)', 'company_unit_price', 0.5],
            ['Company unit cost ($)', 'company_unit_cost', 0.5],
            ['Company target margin', 'company_target_margin', 0.01],
            ['Retail shelf price ($)', 'retail_shelf_price', 0.5],
            ['Retailer margin floor', 'retailer_margin_floor', 0.01],
            ['Consumer WTP median ($)', 'wtp_median', 0.5],
            ['Consumer WTP p90 ($)', 'wtp_p90', 0.5],
          ] as const).map(([label, key, step]) => (
            <div key={key}>
              <label className="label-xs block mb-1">{label}</label>
              <input type="number" step={step} value={(form as any)[key]}
                onChange={e => set(key, +e.target.value)}
                className="w-full text-sm bg-bg-elevated border border-border rounded-lg px-3 py-2 text-text-primary outline-none focus:border-accent-blue" />
            </div>
          ))}
          <button onClick={run} disabled={mut.isPending} className="btn-primary w-full disabled:opacity-50">
            {mut.isPending ? 'Scoring…' : 'Evaluate 3-C'}
          </button>
        </div>

        {/* Results */}
        <div className="xl:col-span-2 space-y-4">
          {!res ? (
            <div className="card p-10 text-center text-text-muted">
              <p className="text-4xl mb-3">⚖️</p>
              <p>Enter a proposed price action and evaluate the joint 3-C balance.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="card-elevated p-5 text-center flex flex-col justify-center"
                  style={{ borderTop: `3px solid ${RATING_COLOR[res.rating]}` }}>
                  <p className="label-xs mb-1">Joint Score</p>
                  <p className="text-5xl font-bold" style={{ color: RATING_COLOR[res.rating] }}>{res.joint_score}</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: RATING_COLOR[res.rating] }}>{res.rating}</p>
                  <p className="text-xs text-text-muted mt-2">
                    Binding constraint: <span className="text-text-secondary font-medium">{res.binding_constraint}</span>
                  </p>
                  {res.guardrail && (
                    <p className={`text-xs mt-2 ${res.allowed ? 'text-accent-green' : 'text-accent-red'}`}>
                      {res.allowed ? '✓ Passes 3-C intercept' : '✗ Blocked by 3-C intercept'}
                    </p>
                  )}
                </div>
                <div className="card p-3">
                  <ResponsiveContainer width="100%" height={210}>
                    <RadarChart data={radar} outerRadius={75}>
                      <PolarGrid stroke="#2D3460" />
                      <PolarAngleAxis dataKey="axis" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} />
                      <Radar dataKey="score" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.4} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Axis detail */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { name: 'Company', d: res.axes.company, color: '#3B82F6',
                    rows: [['Actual margin', `${res.axes.company.actual_margin_pct}%`],
                           ['Target', `${res.axes.company.target_margin_pct}%`]] },
                  { name: 'Customer', d: res.axes.customer, color: '#F97316',
                    rows: [['Retailer margin', `${res.axes.customer.retailer_margin_pct}%`],
                           ['Floor', `${res.axes.customer.margin_floor_pct}%`]] },
                  { name: 'Consumer', d: res.axes.consumer, color: '#8B5CF6',
                    rows: [['WTP headroom', `${res.axes.consumer.wtp_headroom_ratio}`],
                           ['Proposed price', `$${res.axes.consumer.proposed_price}`]] },
                ].map(({ name, d, color, rows }) => (
                  <div key={name} className="card p-4" style={{ borderTop: `3px solid ${color}` }}>
                    <p className="label-xs mb-1">{name}</p>
                    <p className="text-2xl font-bold" style={{ color }}>{d.score}</p>
                    <div className="mt-2 space-y-1">
                      {rows.map(([k, v]) => (
                        <div key={k} className="flex justify-between text-xs">
                          <span className="text-text-muted">{k}</span>
                          <span className="text-text-secondary font-medium">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
