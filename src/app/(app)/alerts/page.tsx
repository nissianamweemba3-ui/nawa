"use client"

import { useState, useMemo } from "react"
import { ALERTS } from "@/lib/mock-data"

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const sevBadge: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border border-red-500/30",
  warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  info: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
}

const typeIcon: Record<string, string> = {
  offline: "📡",
  dormant: "💤",
  speeding: "🚨",
  geofence: "🗺️",
  harsh: "⚡",
  fuel: "⛽",
  maintenance: "🔧",
  preincident: "⚠️",
}

const TABS = ["all", "critical", "warning", "info", "resolved"] as const
type Tab = typeof TABS[number]

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all")

  const unresolvedCritical = ALERTS.filter(a => a.severity === "critical" && !a.resolved).length

  const filtered = useMemo(() => {
    return ALERTS.filter(a => {
      if (activeTab === "all") return true
      if (activeTab === "resolved") return a.resolved
      return a.severity === activeTab && !a.resolved
    })
  }, [activeTab])

  const tabCounts: Record<Tab, number> = {
    all: ALERTS.length,
    critical: ALERTS.filter(a => a.severity === "critical" && !a.resolved).length,
    warning: ALERTS.filter(a => a.severity === "warning" && !a.resolved).length,
    info: ALERTS.filter(a => a.severity === "info" && !a.resolved).length,
    resolved: ALERTS.filter(a => a.resolved).length,
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Alerts & Exceptions</h1>
            {unresolvedCritical > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {unresolvedCritical} CRITICAL
              </span>
            )}
          </div>
          <p className="text-sm text-[#94a3b8] mt-1">Fleet-wide alerts, exceptions and event log</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
              activeTab === tab
                ? "bg-[#f5a623]/20 border border-[#f5a623] text-[#f5a623]"
                : "bg-[#121925] border border-[#1f2a3a] text-[#5b6b82] hover:text-white"
            }`}
          >
            <span className="capitalize">{tab}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab ? "bg-[#f5a623]/30" : "bg-[#1f2a3a]"}`}>
              {tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2a3a]">
                {["ID", "Type", "Description", "Vehicle", "Driver", "Market", "Severity", "Time", "Status"].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, idx) => (
                <tr key={a.id} className={`border-b border-[#1f2a3a]/50 hover:bg-[#161f2e]/60 transition-colors ${idx % 2 === 0 ? "" : "bg-[#0e131c]/30"}`}>
                  <td className="px-4 py-3 text-xs text-[#5b6b82] font-mono">{a.id}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8] capitalize">
                    <span className="mr-1">{typeIcon[a.alert_type] ?? "🔔"}</span>
                    {a.alert_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8] max-w-[200px]">{a.description}</td>
                  <td className="px-4 py-3 text-sm text-white font-mono">{a.vehicle}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{a.driver}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{a.market}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sevBadge[a.severity]}`}>
                      {a.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#5b6b82]">{timeAgo(a.created_at)}</td>
                  <td className="px-4 py-3">
                    {a.resolved ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">RESOLVED</span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#1f2a3a] text-[#5b6b82]">OPEN</span>
                    )}
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
