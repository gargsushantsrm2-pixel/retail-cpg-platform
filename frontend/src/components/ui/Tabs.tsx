import { useState, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface Tab { id: string; label: string }

interface TabsProps {
  tabs:      Tab[]
  children:  (activeId: string) => ReactNode
  className?: string
}

export function Tabs({ tabs, children, className }: TabsProps) {
  const [active, setActive] = useState(tabs[0]?.id)
  return (
    <div className={cn('animate-fade-in', className)}>
      <div className="tab-list mb-5 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={cn('tab-item', active === t.id && 'tab-item-active')}
          >
            {t.label}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  )
}
