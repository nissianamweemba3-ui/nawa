"use client"

import { useState, useMemo } from "react"
import { TRACKING_DEVICES, KPI_STATS, MARKETS, MARKET_NAMES } from "@/lib/mock-data"

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const healthBadge: Record<string, string> = {
  healthy: "bg-green-500/20 text-green-400 border border-green-500/30",
  warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  critical: "bg-red-500/20 text-red-400 border border-red-500/30",
}

const statusBadge: Record<string, string> = {
  installed: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  uninstalled: "bg-[#1f2a3a] text-[#5b6b82] border border-[#28374d]",
}

export default function DevicesPage() {
  const [search, setSearch] = useState("")
  const [healthFilter, setHealthFilter] = useState("all")
  const [marketFilter, setMarketFilter] = useState("all")

  const healthy = TRACKING_DEVICES.filter(d => d.health === "healthy").length
  const warning = TRACKING_DEVICES.filter(d => d.health === "warning").length
  const critical = TRACKING_DEVICES.filter(d => d.health === "critical").length
  const installed = TRACKING_DEVICES.filter(d => d.status === "installed").length
  const uninstalled = TRACKING_DEVICES.filter(d => d.status === "uninstalled").length

  const filtered = useMemo(() => {
    return TRACKING_DEVICES.filter(d => {
      const q = search.toLowerCase()
      const matchSearch = !q || d.id.toLowerCase().includes(q) || d.imei.includes(q) || d.model.toLowerCase().includes(q)
      const matchHealth = healthFilter === "all" || d.health === healthFilter
      const matchMarket = marketFilter === "all" || d.market === marketFilter
      return matchSearch && matchHealth && matchMarket
    })
  }, [search, healthFilter, marketFilter])

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      <div>
        <h1 className="text-2xl font-bold text-white">Tracking Devices</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Hardware tracker inventory and health monitoring</p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        {[
          { label: "Total", value: TRACKING_DEVICES.length, color: "#5b6b82" },
          { label: "Installed", value: installed, color: "#38bdf8" },
          { label: "Uninstalled", value: uninstalled, color: "#5b6b82" },
          { label: "Healthy", value: healthy, color: "#34d399" },
          { label: "Warning", value: warning, color: "#f59e0b" },
          { label: "Critical", value: critical, color: "#f87171" },
        ].map(s => (
          <div key={s.label} className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            <span className="text-sm text-[#94a3b8]">{s.label}</span>
            <span className="text-lg font-bold text-white">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Overall Health Bar */}
      <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-white">Overall Fleet Device Health</p>
          <span className="text-2xl font-bold text-[#34d399]">{KPI_STATS.device_health_pct}%</span>
        </div>
        <div className="h-3 bg-[#0a0e14] rounded-full overflow-hidden flex">
          <div className="h-full bg-[#34d399] transition-all" style={{ width: `${(healthy / TRACKING_DEVICES.length) * 100}%` }} />
          <div className="h-full bg-[#f59e0b] transition-all" style={{ width: `${(warning / TRACKING_DEVICES.length) * 100}%` }} />
          <div className="h-full bg-[#f87171] transition-all" style={{ width: `${(critical / TRACKING_DEVICES.length) * 100}%` }} />
        </div>
        <div className="flex gap-6 mt-2">
          {[{ label: "Healthy", color: "#34d399", count: healthy }, { label: "Warning", color: "#f59e0b", count: warning }, { label: "Critical", color: "#f87171", count: critical }].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: item.color }} />
              <span className="text-xs text-[#5b6b82]">{item.label} ({item.count})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none w-64"
          placeholder="Search device ID, IMEI, model..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none"
          value={healthFilter}
          onChange={e => setHealthFilter(e.target.value)}
        >
          <option value="all">All Health</option>
          <option value="healthy">Healthy</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
        <select
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none"
          value={marketFilter}
          onChange={e => setMarketFilter(e.target.value)}
        >
          <option value="all">All Markets</option>
          {MARKETS.map(m => <option key={m} value={m}>{MARKET_NAMES[m]}</option>)}
        </select>
        <span className="ml-auto text-sm text-[#5b6b82] self-center">{filtered.length} devices</span>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2a3a]">
                {["Device ID", "IMEI", "Model", "Status", "Health", "Last Seen", "Firmware", "Market"].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, idx) => (
                <tr key={d.id} className={`border-b border-[#1f2a3a]/50 hover:bg-[#161f2e]/60 transition-colors ${idx % 2 === 0 ? "" : "bg-[#0e131c]/30"}`}>
                  <td className="px-4 py-3 text-sm text-white font-mono">{d.id}</td>
                  <td className="px-4 py-3 text-xs text-[#5b6b82] font-mono">{d.imei}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{d.model}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge[d.status]}`}>
                      {d.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${healthBadge[d.health]}`}>
                      {d.health.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#5b6b82]">{timeAgo(d.last_seen)}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8] font-mono">{d.firmware}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{d.market}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
