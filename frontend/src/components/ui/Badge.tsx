import { cn } from '../../lib/utils'

type Variant = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan' | 'orange'

const VARIANTS: Record<Variant, string> = {
  blue:   'bg-accent-blue/10   text-accent-blue   border-accent-blue/20',
  green:  'bg-accent-green/10  text-accent-green  border-accent-green/20',
  amber:  'bg-accent-amber/10  text-accent-amber  border-accent-amber/20',
  red:    'bg-accent-red/10    text-accent-red    border-accent-red/20',
  purple: 'bg-accent-purple/10 text-accent-purple border-accent-purple/20',
  cyan:   'bg-accent-cyan/10   text-accent-cyan   border-accent-cyan/20',
  orange: 'bg-accent-orange/10 text-accent-orange border-accent-orange/20',
}

interface BadgeProps {
  children:  React.ReactNode
  variant?:  Variant
  className?: string
}

export default function Badge({ children, variant = 'blue', className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded text-[0.68rem] font-semibold uppercase tracking-wide border',
      VARIANTS[variant],
      className,
    )}>
      {children}
    </span>
  )
}

export function RiskBadge({ risk }: { risk: string }) {
  const map: Record<string, { variant: Variant; label: string }> = {
    CRITICAL: { variant: 'red',   label: 'Critical' },
    HIGH:     { variant: 'amber', label: 'High' },
    MEDIUM:   { variant: 'blue',  label: 'Medium' },
    Critical: { variant: 'red',   label: 'Critical' },
    Low:      { variant: 'amber', label: 'Low' },
    Healthy:  { variant: 'green', label: 'Healthy' },
  }
  const { variant = 'blue', label = risk } = map[risk] ?? {}
  return <Badge variant={variant}>{label}</Badge>
}
