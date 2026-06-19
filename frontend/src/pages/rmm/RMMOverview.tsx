import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Circle, Layers } from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { fetchRmmFeatures } from '../../api/rmm'

const TIER_COLOR: Record<string, string> = {
  DIAGNOSTIC: '#06B6D4', INDEXING: '#3B82F6', PREDICTIVE: '#8B5CF6', PRESCRIPTIVE: '#F97316',
}

export default function RMMOverview() {
  const { data, isLoading } = useQuery({ queryKey: ['rmm', 'features'], queryFn: fetchRmmFeatures })

  if (isLoading || !data) return <Spinner />

  const kpis = [
    { label: 'Total Features', value: data.total_features, color: '#3B82F6' },
    { label: 'Modules', value: data.total_modules, color: '#8B5CF6' },
    { label: 'Live Engines', value: data.live, color: '#10B981' },
    { label: 'Scaffolded', value: data.scaffolded, color: '#F59E0B' },
    { label: 'Enabled', value: data.enabled, color: '#06B6D4' },
  ]

  return (
    <div className="animate-slide-in">
      <PageHeader title="Revenue Margin Management"
        subtitle="3-C Joint Optimization · 24 modules · 44 features · progressive scope scaffolding" />

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center" style={{ borderTop: `3px solid ${color}` }}>
            <p className="label-xs mb-2">{label}</p>
            <p className="text-2xl font-bold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tier distribution */}
      <div className="card p-5 mb-5">
        <h3 className="text-sm font-semibold mb-3">Rollout Tiers (Module 22 — Progressive Scope Scaffolding)</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(data.tiers || {}).map(([tier, n]: any) => (
            <div key={tier} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-elevated border border-border">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TIER_COLOR[tier] || '#888' }} />
              <span className="text-xs text-text-secondary">{tier}</span>
              <span className="text-xs font-bold text-text-primary">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Module map */}
      <div className="grid xl:grid-cols-2 gap-4">
        {(data.modules || []).map((m: any) => (
          <div key={m.module} className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5 text-accent-purple" />
              </span>
              <h3 className="text-sm font-semibold">M{m.module} · {m.module_name}</h3>
            </div>
            <div className="space-y-1.5">
              {m.features.map((f: any) => {
                const live = f.status === 'LIVE'
                return (
                  <div key={f.id} className="flex items-center gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                    {live
                      ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-accent-green" />
                      : <Circle className="w-3.5 h-3.5 shrink-0 text-text-muted" />}
                    <span className="text-text-muted w-6">F{f.id}</span>
                    <span className={live ? 'text-text-primary' : 'text-text-secondary'}>{f.name}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-medium"
                        style={{ background: `${TIER_COLOR[f.tier]}22`, color: TIER_COLOR[f.tier] }}>
                        {f.tier}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-semibold ${
                        live ? 'bg-accent-green/15 text-accent-green' : 'bg-bg-elevated text-text-muted'}`}>
                        {f.status}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
