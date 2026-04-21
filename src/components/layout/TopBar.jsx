import { useState, useMemo, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Calendar, Download, ChevronDown, UserCircle2 } from 'lucide-react'
import { districts } from '../../data/districts.js'
import { schools } from '../../data/schools.js'

export default function TopBar() {
  const [search, setSearch] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [district, setDistrict] = useState('all')
  const [dateRange, setDateRange] = useState('last_30_days')
  const navigate = useNavigate()
  const searchRef = useRef(null)

  const matches = useMemo(() => {
    if (!search.trim()) return []
    const q = search.toLowerCase()
    return schools
      .filter(
        (s) =>
          s.school_name.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q) ||
          s.school_id.toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [search])

  useEffect(() => {
    function onClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <header className="z-20 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-6">
      <div ref={searchRef} className="relative w-96">
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <Search size={16} className="text-slate-400" />
          <input
            className="w-full bg-transparent text-sm placeholder-slate-400 outline-none"
            placeholder="Search school by name, ID, or district…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowResults(true)
            }}
            onFocus={() => setShowResults(true)}
          />
        </div>
        {showResults && matches.length > 0 && (
          <div className="absolute left-0 right-0 top-12 z-30 max-h-80 overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
            {matches.map((s) => (
              <Link
                key={s.school_id}
                to={`/schools/${s.school_id}`}
                onClick={() => {
                  setShowResults(false)
                  setSearch('')
                }}
                className="block border-b border-slate-100 px-4 py-2 text-sm last:border-b-0 hover:bg-slate-50"
              >
                <div className="font-medium text-slate-900">{s.school_name}</div>
                <div className="text-xs text-slate-500">
                  {s.school_id} · {s.district} · {s.school_type}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Calendar size={16} className="text-slate-400" />
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="last_7_days">Last 7 days</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="last_90_days">Last 90 days</option>
          <option value="year_to_date">Year to date</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={district}
          onChange={(e) => {
            setDistrict(e.target.value)
            if (e.target.value !== 'all') navigate('/districts')
          }}
          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="all">All districts</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          <Download size={14} />
          Export
        </button>
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">
          <UserCircle2 size={18} className="text-slate-500" />
          <span>Dist. Health Officer</span>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>
    </header>
  )
}
