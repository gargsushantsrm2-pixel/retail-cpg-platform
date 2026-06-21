import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Lightbulb, Scale, Zap, Tag, FileSignature, Boxes, Users, ArrowRight,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { Spinner } from '../components/ui/Spinner'
import { useExecutiveSummary } from '../api/queries'
import { fetchCompetitorIndex, fetchDecisionGuides, fetchStakeholder } from '../api/rmm'
import { fmtCurrency } from '../lib/utils'

const ROLES = [
  { id: 'finance', label: 'Finance' },
  { id: 'sales', label: 'Sales / KAM' },
  { id: 'brand_marketing', label: 'Brand Marketing' },
]

const PLAYBOOKS = [
  { to: '/rmm/three-c', icon: Scale, color: '#6366F1', title: 'Price a SKU', desc: 'Score a price action on the 3-C balance' },
  { to: '/rmm/promo', icon: Tag, color: '#F59E0B', title: 'Plan a promotion', desc: 'Simulate lift & ROI, then schedule it' },
  { to: '/rmm/elasticity', icon: Zap, color: '#06B6D4', title: 'Understand demand', desc: 'Elasticity, contexts & cannibalization' },
  { to: '/rmm/trade-terms', icon: FileSignature, color: '#F97316', title: 'Approve a deal', desc: 'G2N approval, funds & claims' },
  { to: '/rmm/price-arch', icon: Boxes, color: '#3B82F6', title: 'Design pack architecture', desc: 'Per-ounce, tiers, premiumization' },
  { to: '/rmm/consumer', icon: Users, color: '#EC4899', title: 'Simulate shoppers', desc: 'Agent-based shelf & WTP' },
]

export default function CommandCenter() {
  const [role, setRole] = useState('finance')
  const { data: summary } = useExecutiveSummary()
  const { data: stake } = useQuery({ queryKey: ['cc', 'stake', role], queryFn: () => fetchStakeholder(role) })
  const { data: comp } = useQuery({ queryKey: ['cc', 'comp'], queryFn: fetchCompetitorIndex })
  const { data: guides } = useQuery({ queryKey: ['cc', 'guides'], queryFn: () => fetchDecisionGuides(4) })

  const alerts = comp?.data?.alerts ?? []
  const actions = guides?.data?.guides ?? []
  const stakeMetrics = stake?.data?.metrics ?? {}

  return (
    <div className="animate-slide-in">
      <PageHeader title="Command Center"
        subtitle="Your portfolio at a glance — what needs attention and what to do next" />

      {/* Role switch + role metrics */}
      <div className="card p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="label-xs">View as</span>
          {ROLES.map(r => (
            <button key={r.id} onClick={() => setRole(r.id)}
              className={role === r.id ? 'btn-primary py-1 px-3 text-xs' : 'btn-secondary py-1 px-3 text-xs'}>
              {r.label}
            </button>
          ))}
          {stake?.data?.headline && <span className="ml-auto text-xs text-text-muted">{stake.data.headline}</span>}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {Object.entries(stakeMetrics).slice(0, 5).map(([k, v]: any) => (
            <div key={k} className="card-elevated p-3">
              <p className="label-xs mb-1">{k.replace(/_/g, ' ')}</p>
              <p className="text-lg font-bold text-text-primary">
                {typeof v === 'number' && Math.abs(v) > 1000 ? fmtCurrency(v) : String(v)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4 mb-5">
        {/* Needs attention */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-accent-amber" />
            <h3 className="text-sm font-semibold">Needs Attention</h3>
            <span className="ml-auto text-xs text-text-muted">{alerts.length} alert(s)</span>
          </div>
          {alerts.length === 0 ? (
            <p className="text-xs text-text-muted">No competitor-corridor breaches. Portfolio within guardrails.</p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 6).map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-elevated border border-border">
                  <span className="px-2 py-0.5 rounded text-[0.65rem] font-semibold bg-accent-red/15 text-accent-red">{a.status}</span>
                  <span className="text-xs text-text-secondary">{a.brand} ({a.category})</span>
                  <span className="ml-auto text-xs text-text-muted">index {a.price_index} · ${a.our_price} vs ${a.competitor_avg}</span>
                </div>
              ))}
              <Link to="/rmm/price-arch" className="text-xs text-accent-blue inline-flex items-center gap-1 mt-1">
                Open Price Architecture <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Recommended actions */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-accent-green" />
            <h3 className="text-sm font-semibold">Recommended Actions</h3>
            <span className="ml-auto text-xs text-text-muted">cost-spike playbook</span>
          </div>
          {actions.length === 0 ? <Spinner /> : (
            <div className="space-y-2.5">
              {actions.map((g: any) => (
                <div key={g.product_id} className="p-2.5 rounded-lg bg-bg-elevated border border-border">
                  <p className="text-xs font-medium text-text-primary mb-1">{g.sku_name?.slice(0, 34)} <span className="text-text-muted">· GM {g.current_gm_pct}%</span></p>
                  <p className="text-xs text-text-secondary flex gap-1.5"><span className="text-accent-green">▸</span>{g.actions?.[0]}</p>
                </div>
              ))}
              <Link to="/rmm/investment" className="text-xs text-accent-blue inline-flex items-center gap-1 mt-1">
                See all decision guides <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Portfolio KPIs */}
      {summary && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          {[
            { k: 'revenue', color: '#3B82F6' }, { k: 'gross_profit', color: '#10B981' },
            { k: 'gross_margin', color: '#8B5CF6' }, { k: 'market_share', color: '#F59E0B' },
          ].map(({ k, color }) => {
            const m = (summary as any)[k]
            if (!m) return null
            const val = m.unit === '$' ? fmtCurrency(m.value) : m.unit === '%' ? `${m.value}%` : m.value.toLocaleString()
            return (
              <div key={k} className="card p-4 text-center" style={{ borderTop: `3px solid ${color}` }}>
                <p className="label-xs mb-1">{m.label}</p>
                <p className="text-2xl font-bold" style={{ color }}>{val}</p>
                <p className="text-xs mt-0.5" style={{ color: m.vs_py_pct >= 0 ? '#10B981' : '#EF4444' }}>
                  {m.vs_py_pct >= 0 ? '+' : ''}{m.vs_py_pct}% vs PY
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Playbooks */}
      <h3 className="text-sm font-semibold mb-3">Start a Playbook</h3>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {PLAYBOOKS.map(p => (
          <Link key={p.to} to={p.to}
            className="card p-5 hover:bg-bg-elevated/60 transition-colors group" style={{ borderLeft: `3px solid ${p.color}` }}>
            <div className="flex items-center gap-3 mb-1.5">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${p.color}22`, color: p.color }}>
                <p.icon className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-text-primary">{p.title}</span>
              <ArrowRight className="w-4 h-4 ml-auto text-text-muted group-hover:text-text-primary transition-colors" />
            </div>
            <p className="text-xs text-text-muted pl-11">{p.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
