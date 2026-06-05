import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'

interface KpiCardProps {
  label:       string
  value:       string
  delta?:      number
  deltaLabel?: string
  accent?:     string
  sublabel?:   string
  className?:  string
}

export default function KpiCard({ label, value, delta, deltaLabel = 'vs PY', accent = '#3B82F6', sublabel, className }: KpiCardProps) {
  const isPositive = (delta ?? 0) > 0
  const isNegative = (delta ?? 0) < 0
  const isNeutral  = delta === undefined || delta === 0

  return (
    <div
      className={cn('card relative overflow-hidden p-5 transition-transform duration-150 hover:-translate-y-0.5', className)}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      {/* Glow */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none rounded-xl"
        style={{ background: `radial-gradient(ellipse at top left, ${accent}, transparent 60%)` }}
      />

      <p className="label-xs mb-3">{label}</p>
      <p className="text-3xl font-bold tracking-tight text-text-primary">{value}</p>

      {sublabel && <p className="text-xs text-text-muted mt-1">{sublabel}</p>}

      {delta !== undefined && (
        <div className={cn(
          'flex items-center gap-1 mt-2.5 text-xs font-medium',
          isPositive ? 'text-accent-green' : isNegative ? 'text-accent-red' : 'text-text-muted',
        )}>
          {isPositive  ? <TrendingUp className="w-3.5 h-3.5" /> :
           isNegative  ? <TrendingDown className="w-3.5 h-3.5" /> :
                         <Minus className="w-3.5 h-3.5" />}
          <span>{Math.abs(delta).toFixed(1)}{isNeutral ? '' : '%'}</span>
          <span className="text-text-muted font-normal">{deltaLabel}</span>
        </div>
      )}
    </div>
  )
}
