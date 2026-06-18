"use client"

import { KPI_STATS, ALERTS, SIM_CARDS, buildTrend30 } from "@/lib/mock-data"
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts"

const trend = buildTrend30()

const pieData = [
  { name: "Active", value: KPI_STATS.active_sims, color: "#34d399" },
  { name: "Offline", value: KPI_STATS.offline_sims, color: "#f59e0b" },
  { name: "Dormant", value: KPI_STATS.dormant_sims, color: "#f87171" },
]

const lineData = trend.labels.map((label, i) => ({
  date: label,
  active: trend.active[i],
  offline: trend.offline[i],
}))

const KPI_CARDS = [
  { label: "Total SIMs", value: KPI_STATS.total_sims, border: "#5b6b82", delta: null },
  { label: "Active SIMs", value: KPI_STATS.active_sims, border: "#34d399", delta: `${((KPI_STATS.active_sims / KPI_STATS.total_sims) * 100).toFixed(1)}%` },
  { label: "Offline SIMs", value: KPI_STATS.offline_sims, border: "#f59e0b", delta: `${((KPI_STATS.offline_sims / KPI_STATS.total_sims) * 100).toFixed(1)}%` },
  { label: "Dormant SIMs", value: KPI_STATS.dormant_sims, border: "#f87171", delta: `${((KPI_STATS.dormant_sims / KPI_STATS.total_sims) * 100).toFixed(1)}%` },
  { label: "Active Vehicles", value: KPI_STATS.active_vehicles, border: "#34d399", delta: `${KPI_STATS.total_vehicles} total` },
  { label: "Device Health", value: `${KPI_STATS.device_health_pct}%`, border: "#818cf8", delta: "Overall score" },
  { label: "Fleet Utilization", value: `${KPI_STATS.fleet_utilization_pct}%`, border: "#f5a623", delta: "Moving vehicles" },
  { label: "Total Customers", value: KPI_STATS.customers, border: "#38bdf8", delta: `${KPI_STATS.active_customers} active` },
]

const sevColor: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border border-red-500/30",
  warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  info: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
}

function timeAgo(date: Date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function DashboardPage() {
  const now = new Date()
  const recentAlerts = ALERTS.slice(0, 5)
  const offlineSims = SIM_CARDS.filter(s => s.status === "offline").slice(0, 5)

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Executive Dashboard</h1>
          <p className="text-sm text-[#94a3b8] mt-1">Fleet-wide operational overview across all SADC markets</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#5b6b82] uppercase tracking-widest">Last Updated</p>
          <p className="text-sm text-[#94a3b8]">{now.toLocaleString("en-GB")}</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPI_CARDS.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-4 relative overflow-hidden"
            style={{ borderLeft: `3px solid ${kpi.border}` }}
          >
            <p className="text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold mb-1">{kpi.label}</p>
            <p className="text-3xl font-bold text-white">{kpi.value}</p>
            {kpi.delta && <p className="text-xs text-[#5b6b82] mt-1">{kpi.delta}</p>}
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut */}
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-5">
          <p className="text-xl font-bold text-white mb-1">SIM Status Distribution</p>
          <p className="text-sm text-[#94a3b8] mb-4">Current SIM card health snapshot</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3}>
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#121925", border: "1px solid #1f2a3a", borderRadius: 8, color: "#fff" }}
                formatter={(v) => [`${v} SIMs`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: d.color }} />
                <span className="text-xs text-[#94a3b8]">{d.name} ({d.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Line chart */}
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-5">
          <p className="text-xl font-bold text-white mb-1">30-Day SIM Activity Trend</p>
          <p className="text-sm text-[#94a3b8] mb-4">Active vs Offline over the last 30 days</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={lineData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2a3a" />
              <XAxis dataKey="date" tick={{ fill: "#5b6b82", fontSize: 10 }} interval={6} />
              <YAxis tick={{ fill: "#5b6b82", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#121925", border: "1px solid #1f2a3a", borderRadius: 8, color: "#fff" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
              <Line type="monotone" dataKey="active" stroke="#34d399" strokeWidth={2} dot={false} name="Active" />
              <Line type="monotone" dataKey="offline" stroke="#f59e0b" strokeWidth={2} dot={false} name="Offline" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Alerts */}
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-5">
          <p className="text-xl font-bold text-white mb-4">Recent Alerts</p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2a3a]">
                {["Severity", "Type", "Vehicle", "Time"].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold pb-2 pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentAlerts.map(a => (
                <tr key={a.id} className="border-b border-[#1f2a3a]/50">
                  <td className="py-2 pr-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sevColor[a.severity]}`}>
                      {a.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-sm text-[#94a3b8] capitalize">{a.alert_type}</td>
                  <td className="py-2 pr-3 text-sm text-white font-mono">{a.vehicle}</td>
                  <td className="py-2 text-sm text-[#5b6b82]">{timeAgo(a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Offline SIMs */}
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-5">
          <p className="text-xl font-bold text-white mb-4">Offline SIMs Needing Attention</p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2a3a]">
                {["SIM Number", "Provider", "Vehicle", "Last Comm"].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold pb-2 pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offlineSims.map(sim => (
                <tr key={sim.id} className="border-b border-[#1f2a3a]/50">
                  <td className="py-2 pr-3 text-sm text-white font-mono">{sim.sim_number}</td>
                  <td className="py-2 pr-3 text-sm text-[#94a3b8]">{sim.network_provider}</td>
                  <td className="py-2 pr-3 text-sm text-[#94a3b8]">{sim.assigned_vehicle ?? "—"}</td>
                  <td className="py-2 text-sm text-[#5b6b82]">{timeAgo(sim.last_communication)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
