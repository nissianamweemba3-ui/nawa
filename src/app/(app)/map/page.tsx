"use client"

import { useState, useMemo } from "react"
import { VEHICLES, MARKET_NAMES } from "@/lib/mock-data"

type StatusFilter = "all" | "moving" | "idling" | "stopped" | "offline"

const statusBadge: Record<string, string> = {
  moving: "bg-green-500/20 text-green-400 border border-green-500/30",
  idling: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  stopped: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  offline: "bg-red-500/20 text-red-400 border border-red-500/30",
}

const statusDot: Record<string, string> = {
  moving: "bg-green-400",
  idling: "bg-amber-400",
  stopped: "bg-blue-400",
  offline: "bg-red-400",
}

const riskBadge: Record<string, string> = {
  Low: "text-green-400",
  Medium: "text-amber-400",
  High: "text-red-400",
}

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function MapPage() {
  const [filter, setFilter] = useState<StatusFilter>("all")

  const filtered = useMemo(() =>
    filter === "all" ? VEHICLES : VEHICLES.filter(v => v.status === filter),
    [filter]
  )

  const counts = {
    all: VEHICLES.length,
    moving: VEHICLES.filter(v => v.status === "moving").length,
    idling: VEHICLES.filter(v => v.status === "idling").length,
    stopped: VEHICLES.filter(v => v.status === "stopped").length,
    offline: VEHICLES.filter(v => v.status === "offline").length,
  }

  const btnStyle = (s: StatusFilter) =>
    filter === s
      ? "bg-[#f5a623]/20 border border-[#f5a623] text-[#f5a623]"
      : "bg-[#121925] border border-[#1f2a3a] text-[#5b6b82] hover:text-white hover:border-[#28374d]"

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Vehicle Map</h1>
          <p className="text-sm text-[#94a3b8] mt-1">Real-time vehicle locations across SADC markets</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-xs text-amber-400 max-w-xs">
          Full interactive map requires Leaflet integration in production. Showing vehicle grid view.
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {(["all", "moving", "idling", "stopped", "offline"] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors capitalize flex items-center gap-2 ${btnStyle(s)}`}
          >
            {s !== "all" && <span className={`w-2 h-2 rounded-full ${statusDot[s]}`} />}
            {s === "all" ? `All (${counts.all})` : `${s} (${counts[s]})`}
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-xl px-5 py-3 flex flex-wrap gap-6">
        <span className="text-sm text-[#5b6b82]">Showing <span className="text-white font-bold">{filtered.length}</span> vehicles</span>
        <span className="text-sm text-[#5b6b82]">Total fleet: <span className="text-white font-bold">{VEHICLES.length}</span></span>
        {filter !== "all" && (
          <span className="text-sm text-[#5b6b82]">Filter: <span className="text-[#f5a623] font-bold capitalize">{filter}</span></span>
        )}
      </div>

      {/* Vehicle Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(v => (
          <div key={v.id} className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-4 hover:border-[#28374d] transition-colors">
            {/* Registration + Status */}
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-bold text-white font-mono">{v.registration}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge[v.status]}`}>
                {v.status.toUpperCase()}
              </span>
            </div>

            {/* Make/Model */}
            <p className="text-xs text-[#5b6b82] mb-3">{v.make} {v.model} · {v.year}</p>

            {/* Details */}
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-xs text-[#5b6b82]">Driver</span>
                <span className="text-xs text-[#94a3b8]">{v.driver}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#5b6b82]">Speed</span>
                <span className="text-xs text-[#94a3b8]">{v.speed > 0 ? `${v.speed} km/h` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#5b6b82]">Location</span>
                <span className="text-xs text-[#94a3b8]">{MARKET_NAMES[v.market]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#5b6b82]">Risk</span>
                <span className={`text-xs font-bold ${riskBadge[v.risk]}`}>{v.risk}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[#5b6b82]">Last Seen</span>
                <span className="text-xs text-[#5b6b82]">{timeAgo(v.last_seen)}</span>
              </div>
            </div>

            {/* Coords */}
            <div className="mt-3 pt-3 border-t border-[#1f2a3a]">
              <p className="text-[10px] text-[#5b6b82] font-mono">
                {v.coords[0].toFixed(4)}, {v.coords[1].toFixed(4)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
