import { Outlet, Link } from "react-router-dom";
import { Sidebar, TopBar } from "@/components/layout/Sidebar";

export function Shell() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col bg-ink-50">
        <TopBar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 max-w-[1400px] mx-auto w-full">
          <Outlet />
        </main>
        <footer className="border-t border-ink-200 bg-white px-4 py-3 text-xs text-ink-500 flex items-center justify-between">
          <div>AP GIS Permission &amp; Monitoring — Prototype</div>
          <div className="flex gap-4">
            <Link to="/assumptions" className="hover:text-ink-700">Prototype assumptions</Link>
            <Link to="/audit" className="hover:text-ink-700">Audit trail</Link>
            <Link to="/demo" className="hover:text-ink-700">Guided demo</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
