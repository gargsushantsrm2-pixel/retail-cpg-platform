import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, ShoppingCart, LineChart,
  Truck, Handshake, Target, Activity,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useQuery } from '@tanstack/react-query'
import { checkHealth } from '../../api/client'

const NAV = [
  { path: '/',           icon: LayoutDashboard, label: 'Executive Dashboard',    color: '#3B82F6' },
  { path: '/rgm',        icon: TrendingUp,      label: 'Revenue Growth',          color: '#8B5CF6' },
  { path: '/category',   icon: ShoppingCart,    label: 'Category Intelligence',   color: '#10B981' },
  { path: '/forecasting',icon: LineChart,        label: 'Demand Forecasting',      color: '#F59E0B' },
  { path: '/supply',     icon: Truck,           label: 'Supply Chain',            color: '#06B6D4' },
  { path: '/commercial', icon: Handshake,       label: 'Commercial Excellence',   color: '#F97316' },
  { path: '/scenario',   icon: Target,          label: 'Scenario Planner',        color: '#EC4899' },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const { data: healthy } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 30_000,
  })

  return (
    <aside className="w-60 shrink-0 bg-bg-sidebar border-r border-border flex flex-col h-screen sticky top-0 overflow-y-auto">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-7 h-7 rounded-lg bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-accent-blue" />
          </div>
          <span className="font-bold text-sm tracking-tight text-text-primary">Decision Intelligence</span>
        </div>
        <p className="text-[0.65rem] uppercase tracking-widest text-text-muted pl-9">Retail & CPG Platform</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="label-xs px-2 py-2 mt-1">Analytics Modules</p>
        {NAV.map(({ path, icon: Icon, label, color }) => {
          const active = path === '/' ? pathname === '/' : pathname.startsWith(path)
          return (
            <NavLink
              key={path}
              to={path}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group',
                active
                  ? 'bg-bg-card text-text-primary font-medium shadow-card'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated',
              )}
            >
              <span
                className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                  active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100',
                )}
                style={{ backgroundColor: `${color}22`, color }}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span className="truncate">{label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Status */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-elevated rounded-lg border border-border">
          <span
            className={cn('w-2 h-2 rounded-full', healthy ? 'bg-accent-green animate-pulse-slow' : 'bg-accent-red')}
          />
          <span className="text-xs text-text-secondary">{healthy ? 'Backend Online' : 'Backend Offline'}</span>
        </div>
        <p className="text-[0.62rem] text-text-muted text-center mt-3">
          CPG Intelligence v1.0
        </p>
      </div>
    </aside>
  )
}
