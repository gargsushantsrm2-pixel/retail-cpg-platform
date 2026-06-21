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
        </div>
      </main>
    </div>
  )
}
