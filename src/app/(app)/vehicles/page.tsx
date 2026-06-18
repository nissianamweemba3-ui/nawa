"use client"

import { useState, useMemo } from "react"
import { VEHICLES, KPI_STATS, MARKETS, MARKET_NAMES } from "@/lib/mock-data"

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const statusBadge: Record<string, string> = {
  moving: "bg-green-500/20 text-green-400 border border-green-500/30",
  idling: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  stopped: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  offline: "bg-red-500/20 text-red-400 border border-red-500/30",
}

const riskBadge: Record<string, string> = {
  Low: "bg-green-500/10 text-green-400",
  Medium: "bg-amber-500/10 text-amber-400",
  High: "bg-red-500/10 text-red-400",
}

export default function VehiclesPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [marketFilter, setMarketFilter] = useState("all")

  const counts = {
    total: VEHICLES.length,
    moving: VEHICLES.filter(v => v.status === "moving").length,
    idling: VEHICLES.filter(v => v.status === "idling").length,
    stopped: VEHICLES.filter(v => v.status === "stopped").length,
    offline: VEHICLES.filter(v => v.status === "offline").length,
  }

  const filtered = useMemo(() => {
    return VEHICLES.filter(v => {
      const q = search.toLowerCase()
      const matchSearch = !q || v.registration.toLowerCase().includes(q) || v.customer_name.toLowerCase().includes(q) || v.driver.toLowerCase().includes(q) || v.make.toLowerCase().includes(q)
      const matchStatus = statusFilter === "all" || v.status === statusFilter
      const matchMarket = marketFilter === "all" || v.market === marketFilter
      return matchSearch && matchStatus && matchMarket
    })
  }, [search, statusFilter, marketFilter])

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      <div>
        <h1 className="text-2xl font-bold text-white">Vehicle Management</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Monitor and manage all fleet vehicles across SADC markets</p>
      </div>

      {/* KPI Strip */}
      <div className="flex flex-wrap gap-4">
        {[
          { label: "Total", value: counts.total, color: "#5b6b82" },
          { label: "Moving", value: counts.moving, color: "#34d399" },
          { label: "Idling", value: counts.idling, color: "#f59e0b" },
          { label: "Stopped", value: counts.stopped, color: "#38bdf8" },
          { label: "Offline", value: counts.offline, color: "#f87171" },
        ].map(s => (
          <div key={s.label} className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-sm text-[#94a3b8]">{s.label}</span>
            <span className="text-lg font-bold text-white">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none w-64"
          placeholder="Search registration, customer, driver..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="moving">Moving</option>
          <option value="idling">Idling</option>
          <option value="stopped">Stopped</option>
          <option value="offline">Offline</option>
        </select>
        <select
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none"
          value={marketFilter}
          onChange={e => setMarketFilter(e.target.value)}
        >
          <option value="all">All Markets</option>
          {MARKETS.map(m => <option key={m} value={m}>{MARKET_NAMES[m]}</option>)}
        </select>
        <span className="ml-auto text-sm text-[#5b6b82] self-center">{filtered.length} vehicles</span>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2a3a]">
                {["Registration", "Make/Model", "Customer", "Driver", "Status", "Speed", "Risk", "Last Seen", "Market", "Actions"].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, idx) => (
                <tr key={v.id} className={`border-b border-[#1f2a3a]/50 hover:bg-[#161f2e]/60 transition-colors ${idx % 2 === 0 ? "" : "bg-[#0e131c]/30"}`}>
                  <td className="px-4 py-3 text-sm text-white font-mono font-bold">{v.registration}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{v.make} {v.model}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8] max-w-[140px] truncate">{v.customer_name}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{v.driver}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge[v.status]}`}>
                      {v.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{v.speed > 0 ? `${v.speed} km/h` : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${riskBadge[v.risk]}`}>
                      {v.risk}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#5b6b82]">{timeAgo(v.last_seen)}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{v.market}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-xs text-[#5b6b82] hover:text-white transition-colors">View</button>
                      <button className="text-xs text-[#5b6b82] hover:text-white transition-colors">Track</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
