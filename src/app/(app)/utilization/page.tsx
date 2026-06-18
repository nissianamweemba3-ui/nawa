"use client"

import { VEHICLES, KPI_STATS, MARKETS, MARKET_NAMES, buildTrend14 } from "@/lib/mock-data"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from "recharts"

const trend14 = buildTrend14()

const marketBarData = MARKETS.map(m => {
  const mvs = VEHICLES.filter(v => v.market === m)
  return {
    market: m,
    Moving: mvs.filter(v => v.status === "moving").length,
    Idling: mvs.filter(v => v.status === "idling").length,
    Stopped: mvs.filter(v => v.status === "stopped").length,
    Offline: mvs.filter(v => v.status === "offline").length,
  }
})

const lineData = trend14.labels.map((label, i) => ({
  date: label,
  vehicles: trend14.values[i],
}))

const avgSpeed = Math.round(
  VEHICLES.filter(v => v.speed > 0).reduce((s, v) => s + v.speed, 0) /
  Math.max(1, VEHICLES.filter(v => v.speed > 0).length)
)

export default function UtilizationPage() {
  const moving = VEHICLES.filter(v => v.status === "moving").length
  const idling = VEHICLES.filter(v => v.status === "idling").length

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      <div>
        <h1 className="text-2xl font-bold text-white">Fleet Utilization</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Vehicle activity, efficiency metrics and market performance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Fleet Utilization", value: `${KPI_STATS.fleet_utilization_pct}%`, border: "#f5a623", sub: "Moving vehicles" },
          { label: "Average Speed", value: `${avgSpeed} km/h`, border: "#34d399", sub: "Moving vehicles only" },
          { label: "Vehicles Moving", value: moving, border: "#34d399", sub: `of ${KPI_STATS.total_vehicles} total` },
          { label: "Idle Count", value: idling, border: "#f59e0b", sub: "Fuel waste concern" },
        ].map(k => (
          <div key={k.label} className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-4" style={{ borderLeft: `3px solid ${k.border}` }}>
            <p className="text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold mb-1">{k.label}</p>
            <p className="text-3xl font-bold text-white">{k.value}</p>
            <p className="text-xs text-[#5b6b82] mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-5">
          <p className="text-xl font-bold text-white mb-1">Vehicles by Status per Market</p>
          <p className="text-sm text-[#94a3b8] mb-4">Grouped by operational status</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={marketBarData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a3a" />
              <XAxis dataKey="market" tick={{ fill: "#5b6b82", fontSize: 11 }} />
              <YAxis tick={{ fill: "#5b6b82", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#121925", border: "1px solid #1f2a3a", borderRadius: 8, color: "#fff" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar dataKey="Moving" fill="#34d399" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Idling" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Stopped" fill="#38bdf8" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Offline" fill="#f87171" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Line Chart */}
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-5">
          <p className="text-xl font-bold text-white mb-1">14-Day Active Vehicle Trend</p>
          <p className="text-sm text-[#94a3b8] mb-4">Daily active vehicle count</p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={lineData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a3a" />
              <XAxis dataKey="date" tick={{ fill: "#5b6b82", fontSize: 10 }} interval={3} />
              <YAxis tick={{ fill: "#5b6b82", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#121925", border: "1px solid #1f2a3a", borderRadius: 8, color: "#fff" }} />
              <Line type="monotone" dataKey="vehicles" stroke="#f5a623" strokeWidth={2.5} dot={{ fill: "#f5a623", r: 3 }} name="Active Vehicles" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Market Performance Table */}
      <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1f2a3a]">
          <p className="text-xl font-bold text-white">Market Performance</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1f2a3a]">
              {["Market", "Total Vehicles", "Moving", "Idling", "Stopped", "Offline", "Utilization %"].map(h => (
                <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MARKETS.map((m, idx) => {
              const mvs = VEHICLES.filter(v => v.market === m)
              const mov = mvs.filter(v => v.status === "moving").length
              const idle = mvs.filter(v => v.status === "idling").length
              const stop = mvs.filter(v => v.status === "stopped").length
              const off = mvs.filter(v => v.status === "offline").length
              const util = mvs.length > 0 ? Math.round((mov / mvs.length) * 100) : 0
              return (
                <tr key={m} className={`border-b border-[#1f2a3a]/50 hover:bg-[#161f2e]/60 transition-colors ${idx % 2 === 0 ? "" : "bg-[#0e131c]/30"}`}>
                  <td className="px-4 py-3 text-sm text-white font-semibold">{MARKET_NAMES[m]}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{mvs.length}</td>
                  <td className="px-4 py-3 text-sm text-green-400 font-bold">{mov}</td>
                  <td className="px-4 py-3 text-sm text-amber-400">{idle}</td>
                  <td className="px-4 py-3 text-sm text-blue-400">{stop}</td>
                  <td className="px-4 py-3 text-sm text-red-400">{off}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-[#0a0e14] rounded-full max-w-[80px]">
                        <div className="h-2 bg-[#f5a623] rounded-full" style={{ width: `${util}%` }} />
                      </div>
                      <span className="text-sm font-bold text-[#f5a623]">{util}%</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
