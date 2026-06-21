import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SectionGuide from '../ui/SectionGuide'
import DeveloperBadge from './DeveloperBadge'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-bg-base">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar with developer "open to work" badge */}
        <div className="sticky top-0 z-40 bg-bg-base/80 backdrop-blur border-b border-border">
          <div className="max-w-[1600px] mx-auto px-6 h-12 flex items-center justify-end">
            <DeveloperBadge />
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <SectionGuide />
          <Outlet />
          <footer className="mt-10 pt-5 border-t border-border text-center space-y-2">
            <p className="text-xs text-text-muted">
              <span className="font-semibold text-text-secondary">Triax</span> — Revenue Margin Intelligence
            </p>
            <div className="flex items-center justify-center gap-4 text-[0.7rem]">
              <span className="text-accent-green font-medium">● Open to Contract &amp; Full-time</span>
              <a href="tel:+919087860807" className="text-text-muted hover:text-accent-blue">+91 90878 60807</a>
              <a href="mailto:sgargandcompany@gmail.com" className="text-text-muted hover:text-accent-blue">sgargandcompany@gmail.com</a>
              <a href="https://www.linkedin.com/in/garg-sushant/" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-blue">LinkedIn</a>
              <a href="https://sushantgarg.netlify.app" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-blue">Portfolio</a>
            </div>
            <p className="text-[0.7rem] text-text-muted">
              Designed &amp; built by Sushant Garg · © 2026 Sushant Garg &amp; Co. All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
