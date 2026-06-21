import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react'
import { GUIDES } from '../../lib/guides'

// One guide panel, driven by the current route. Collapsible and remembers the
// user's preference in localStorage so power users only see it once.
export default function SectionGuide() {
  const { pathname } = useLocation()
  const guide = GUIDES[pathname]
  const storeKey = `guide-open:${pathname}`
  const [open, setOpen] = useState(() => {
    const v = localStorage.getItem(storeKey)
    return v === null ? true : v === '1'
  })

  if (!guide) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    localStorage.setItem(storeKey, next ? '1' : '0')
  }

  return (
    <div className="mb-5 rounded-xl border border-border bg-bg-card/60 overflow-hidden">
      <button onClick={toggle}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-bg-elevated/50 transition-colors">
        <span className="w-6 h-6 rounded-md bg-accent-blue/15 flex items-center justify-center shrink-0">
          <BookOpen className="w-3.5 h-3.5 text-accent-blue" />
        </span>
        <span className="text-xs font-semibold text-text-primary">How to use this section</span>
        <span className="ml-auto text-text-muted">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 grid md:grid-cols-[1.4fr_1fr] gap-4">
          <div>
            <p className="label-xs mb-1">Purpose</p>
            <p className="text-sm text-text-secondary mb-3">{guide.purpose}</p>
            {guide.nextAction && (
              <div className="flex items-start gap-1.5 text-xs text-accent-cyan">
                <ArrowRight className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{guide.nextAction}</span>
              </div>
            )}
          </div>
          <div>
            <p className="label-xs mb-1">How to read it</p>
            <ul className="space-y-1">
              {guide.howToRead.map((h, i) => (
                <li key={i} className="text-xs text-text-secondary flex gap-2">
                  <span className="text-accent-blue mt-0.5">•</span>{h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
