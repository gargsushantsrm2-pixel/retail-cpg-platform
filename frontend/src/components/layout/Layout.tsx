import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Activity } from 'lucide-react'
import Sidebar from './Sidebar'
import SectionGuide from '../ui/SectionGuide'
import DeveloperBadge from './DeveloperBadge'

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-bg-base">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      {/* Mobile backdrop */}
      {navOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setNavOpen(false)} />
      )}

      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar: hamburger (mobile) + brand (mobile) + developer badge */}
        <div className="sticky top-0 z-30 bg-bg-base/80 backdrop-blur border-b border-border">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
            <button
              onClick={() => setNavOpen(true)}
              className="lg:hidden w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:text-text-primary"
              aria-label="Open menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="lg:hidden flex items-center gap-1.5 font-bold text-sm text-text-primary">
              <Activity className="w-4 h-4 text-accent-blue" /> Triax
            </span>
            <div className="ml-auto">
              <DeveloperBadge />
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <SectionGuide />
          <Outlet />
          <footer className="mt-10 pt-5 border-t border-border text-center space-y-2">
            <p className="text-xs text-text-muted">
              <span className="font-semibold text-text-secondary">Triax</span> — Revenue Margin Intelligence
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[0.7rem]">
              <span className="text-accent-green font-medium">● Open to Contract &amp; Full-time</span>
              <a href="tel:+919087860807" className="text-text-muted hover:text-accent-blue">+91 90878 60807</a>
              <a href="mailto:garg.sushant.srm@gmail.com" className="text-text-muted hover:text-accent-blue">garg.sushant.srm@gmail.com</a>
              <a href="https://www.linkedin.com/in/garg-sushant/" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-blue">LinkedIn</a>
              <a href="/Sushant_Garg_CV.pdf" download target="_blank" className="text-accent-blue hover:underline font-medium">Download CV</a>
            </div>
            <p className="text-[0.7rem] text-text-muted">
              Designed &amp; built by Sushant Garg · © 2026 Sushant Garg
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
