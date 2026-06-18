"use client"

import { useState, useMemo } from "react"
import { SIM_CARDS, KPI_STATS, MARKETS, MARKET_NAMES } from "@/lib/mock-data"

const PAGE_SIZE = 20

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const statusBadge: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border border-green-500/30",
  offline: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  dormant: "bg-red-500/20 text-red-400 border border-red-500/30",
}

export default function SimsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [marketFilter, setMarketFilter] = useState("all")
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return SIM_CARDS.filter(s => {
      const q = search.toLowerCase()
      const matchSearch = !q || s.sim_number.includes(q) || s.iccid.includes(q) || s.network_provider.toLowerCase().includes(q) || (s.assigned_vehicle?.toLowerCase().includes(q) ?? false)
      const matchStatus = statusFilter === "all" || s.status === statusFilter
      const matchMarket = marketFilter === "all" || s.market === marketFilter
      return matchSearch && matchStatus && matchMarket
    })
  }, [search, statusFilter, marketFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">SIM Management</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Manage and monitor all SIM cards across the SADC fleet</p>
      </div>

      {/* Stats Strip */}
      <div className="flex flex-wrap gap-4">
        {[
          { label: "Total SIMs", value: KPI_STATS.total_sims, color: "#5b6b82" },
          { label: "Active", value: KPI_STATS.active_sims, color: "#34d399" },
          { label: "Offline", value: KPI_STATS.offline_sims, color: "#f59e0b" },
          { label: "Dormant", value: KPI_STATS.dormant_sims, color: "#f87171" },
        ].map(stat => (
          <div key={stat.label} className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full" style={{ background: stat.color }} />
            <span className="text-sm text-[#94a3b8]">{stat.label}</span>
            <span className="text-lg font-bold text-white">{stat.value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none w-64"
          placeholder="Search SIM number, ICCID, provider..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
        <select
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="offline">Offline</option>
          <option value="dormant">Dormant</option>
        </select>
        <select
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none"
          value={marketFilter}
          onChange={e => { setMarketFilter(e.target.value); setPage(1) }}
        >
          <option value="all">All Markets</option>
          {MARKETS.map(m => (
            <option key={m} value={m}>{MARKET_NAMES[m]}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-[#5b6b82] self-center">{filtered.length} results</span>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2a3a]">
                {["SIM Number", "ICCID", "Provider", "Vehicle", "Status", "Last Comm", "Market", "Actions"].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((sim, idx) => (
                <tr key={sim.id} className={`border-b border-[#1f2a3a]/50 hover:bg-[#161f2e]/60 transition-colors ${idx % 2 === 0 ? "" : "bg-[#0e131c]/30"}`}>
                  <td className="px-4 py-3 text-sm text-white font-mono">{sim.sim_number}</td>
                  <td className="px-4 py-3 text-sm text-[#5b6b82] font-mono text-xs">{sim.iccid}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{sim.network_provider}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{sim.assigned_vehicle ?? <span className="text-[#5b6b82]">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge[sim.status]}`}>
                      {sim.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#5b6b82]">{timeAgo(sim.last_communication)}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{sim.market}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button className="text-xs text-[#5b6b82] hover:text-white transition-colors">Edit</button>
                      <button className="text-xs text-[#5b6b82] hover:text-white transition-colors">View</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-[#1f2a3a]">
          <span className="text-xs text-[#5b6b82]">
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-xs px-3 py-1 rounded-lg bg-[#0a0f17] border border-[#28374d] text-[#94a3b8] disabled:opacity-40 hover:border-[#f5a623] transition-colors"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`text-xs px-3 py-1 rounded-lg border transition-colors ${p === page ? "bg-[#f5a623]/20 border-[#f5a623] text-[#f5a623]" : "bg-[#0a0f17] border-[#28374d] text-[#94a3b8] hover:border-[#f5a623]"}`}
                >
                  {p}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-xs px-3 py-1 rounded-lg bg-[#0a0f17] border border-[#28374d] text-[#94a3b8] disabled:opacity-40 hover:border-[#f5a623] transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
