import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import SectionGuide from '../ui/SectionGuide'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-bg-base">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <SectionGuide />
          <Outlet />
          <footer className="mt-10 pt-5 border-t border-border text-center">
            <p className="text-xs text-text-muted">
              <span className="font-semibold text-text-secondary">Triax</span> — Revenue Margin Intelligence
            </p>
            <p className="text-[0.7rem] text-text-muted mt-1">
              © 2026 Sushant Garg &amp; Co. All rights reserved.
            </p>
          </footer>
        </div>
      </main>
    </div>
  )
}
