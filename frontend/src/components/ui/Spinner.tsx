import { cn } from '../../lib/utils'

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-16', className)}>
      <div className="w-8 h-8 border-2 border-border border-t-accent-blue rounded-full animate-spin" />
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="card p-5 animate-pulse">
      <div className="h-3 w-20 bg-bg-elevated rounded mb-4" />
      <div className="h-8 w-32 bg-bg-elevated rounded mb-2" />
      <div className="h-3 w-16 bg-bg-elevated rounded" />
    </div>
  )
}
