import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, TrendingUp, ShoppingCart, LineChart,
  Truck, Handshake, Target, Activity, Home,
  Scale, Gauge, Zap, Tag, FileSignature, ShieldCheck,
  Users, Boxes, PackageSearch, Wallet, Network,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useQuery } from '@tanstack/react-query'
import { checkHealth } from '../../api/client'

// Single closed-loop journey: Home → Diagnose → Decide (levers) → Optimize →
// Execute & Monitor → Reference. Replaces the two parallel menus.
const HOME = { path: '/', icon: Home, label: 'Command Center', color: '#6366F1' }

const SECTIONS: { label: string; items: { path: string; icon: any; label: string; color: string }[] }[] = [
  {
    label: 'Diagnose',
    items: [
      { path: '/executive',      icon: LayoutDashboard, label: 'Executive Dashboard',  color: '#3B82F6' },
      { path: '/rmm/elasticity', icon: Zap,             label: 'Elasticity Lab',       color: '#06B6D4' },
      { path: '/rmm/consumer',   icon: Users,           label: 'Consumer Science',     color: '#EC4899' },
      { path: '/rmm/demand',     icon: PackageSearch,   label: 'Demand & Assortment',  color: '#F59E0B' },
      { path: '/category',       icon: ShoppingCart,    label: 'Category Intelligence',color: '#10B981' },
      { path: '/forecasting',    icon: LineChart,       label: 'Demand Forecasting',   color: '#F59E0B' },
    ],
  },
  {
    label: 'Decide · Levers',
    items: [
      { path: '/rmm/price-arch',  icon: Boxes,         label: 'Price Architecture',  color: '#3B82F6' },
      { path: '/rmm/promo',       icon: Tag,           label: 'Promo Optimizer',     color: '#F59E0B' },
      { path: '/rmm/trade-terms', icon: FileSignature, label: 'Trade Terms (G2N)',   color: '#F97316' },
      { path: '/rgm',             icon: TrendingUp,    label: 'Revenue Growth',      color: '#8B5CF6' },
    ],
  },
  {
    label: 'Optimize',
    items: [
      { path: '/rmm/three-c',    icon: Scale,       label: '3-C Scorecard',      color: '#6366F1' },
      { path: '/scenario',       icon: Target,      label: 'Scenario Planner',   color: '#EC4899' },
      { path: '/rmm/investment', icon: Wallet,      label: 'Investment & Deals', color: '#84CC16' },
      { path: '/rmm/governance', icon: ShieldCheck, label: 'Margin Governance',  color: '#10B981' },
    ],
  },
  {
    label: 'Execute & Monitor',
    items: [
      { path: '/rmm/platform', icon: Network,   label: 'Platform & Ops',        color: '#06B6D4' },
      { path: '/supply',       icon: Truck,     label: 'Supply Chain',          color: '#06B6D4' },
      { path: '/commercial',   icon: Handshake, label: 'Commercial Excellence', color: '#F97316' },
    ],
  },
  {
    label: 'Reference',
    items: [
      { path: '/rmm', icon: Gauge, label: 'RMM Capability Map', color: '#8B5CF6' },
    ],
  },
]

// Exact match for prefix routes ('/' and '/rmm') so they don't stay active on
// their children; startsWith for the rest.
function renderItem(
  { path, icon: Icon, label, color }: { path: string; icon: any; label: string; color: string },
  pathname: string,
) {
  const exact = path === '/' || path === '/rmm'
  const active = exact ? pathname === path : pathname.startsWith(path)
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
      {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />}
    </NavLink>
  )
}

export default function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { pathname } = useLocation()
  const { data: healthy } = useQuery({
    queryKey: ['health'],
    queryFn: checkHealth,
    refetchInterval: 30_000,
  })

  return (
    <aside
      className={cn(
        'w-60 shrink-0 bg-bg-sidebar border-r border-border flex flex-col h-screen overflow-y-auto z-50',
        'fixed inset-y-0 left-0 transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      )}
      onClick={() => onClose?.()}
    >
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <div className="flex items-center gap-2.5 mb-0.5">
          <div className="w-7 h-7 rounded-lg bg-accent-blue/20 border border-accent-blue/30 flex items-center justify-center">
            <Activity className="w-4 h-4 text-accent-blue" />
          </div>
          <span className="font-bold text-base tracking-tight text-text-primary">Triax</span>
        </div>
        <p className="text-[0.65rem] uppercase tracking-widest text-text-muted pl-9">Revenue Margin Intelligence</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {renderItem(HOME, pathname)}
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="label-xs px-2 py-2 mt-3">{section.label}</p>
            {section.items.map((item) => renderItem(item, pathname))}
          </div>
        ))}
      </nav>

      {/* Status */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 bg-bg-elevated rounded-lg border border-border">
          <span
            className={cn('w-2 h-2 rounded-full', healthy ? 'bg-accent-green animate-pulse-slow' : 'bg-accent-red')}
          />
          <span className="text-xs text-text-secondary">{healthy ? 'Backend Online' : 'Backend Offline'}</span>
        </div>
        <p className="text-[0.62rem] text-text-muted text-center mt-3 leading-relaxed">
          Triax v1.0<br />
          © 2026 Sushant Garg &amp; Co.<br />
          All rights reserved.
        </p>
      </div>
    </aside>
  )
}
