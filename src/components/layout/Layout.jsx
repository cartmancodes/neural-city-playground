import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import TopBar from './TopBar.jsx'

export default function Layout() {
  return (
    <div className="flex h-full min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1500px] px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
