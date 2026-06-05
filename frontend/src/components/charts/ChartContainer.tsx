import { ResponsiveContainer } from 'recharts'
import { cn } from '../../lib/utils'
import type { ReactNode } from 'react'

interface ChartContainerProps {
  title?:     string
  height?:    number
  children:   ReactNode
  className?: string
}

export default function ChartContainer({ title, height = 280, children, className }: ChartContainerProps) {
  return (
    <div className={cn('card p-5', className)}>
      {title && <h3 className="text-sm font-semibold text-text-primary mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}
