"use client"

import { useState, useMemo } from "react"
import { CUSTOMERS, KPI_STATS, MARKETS, MARKET_NAMES } from "@/lib/mock-data"

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

const statusBadge: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border border-green-500/30",
  inactive: "bg-[#1f2a3a] text-[#5b6b82] border border-[#28374d]",
}

export default function CustomersPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [marketFilter, setMarketFilter] = useState("all")

  const totalVehicles = CUSTOMERS.reduce((s, c) => s + c.vehicle_count, 0)

  const filtered = useMemo(() => {
    return CUSTOMERS.filter(c => {
      const q = search.toLowerCase()
      const matchSearch = !q || c.company_name.toLowerCase().includes(q) || c.contact_person.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
      const matchStatus = statusFilter === "all" || c.status === statusFilter
      const matchMarket = marketFilter === "all" || c.market === marketFilter
      return matchSearch && matchStatus && matchMarket
    })
  }, [search, statusFilter, marketFilter])

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      <div>
        <h1 className="text-2xl font-bold text-white">Customer Management</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Manage fleet customers across all SADC markets</p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        {[
          { label: "Total Customers", value: KPI_STATS.customers, color: "#5b6b82" },
          { label: "Active", value: KPI_STATS.active_customers, color: "#34d399" },
          { label: "Inactive", value: KPI_STATS.customers - KPI_STATS.active_customers, color: "#5b6b82" },
          { label: "Total Vehicles", value: totalVehicles, color: "#38bdf8" },
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
          placeholder="Search company, contact, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-3 py-2 text-sm outline-none"
          value={marketFilter}
          onChange={e => setMarketFilter(e.target.value)}
        >
          <option value="all">All Markets</option>
          {MARKETS.map(m => <option key={m} value={m}>{MARKET_NAMES[m]}</option>)}
        </select>
        <span className="ml-auto text-sm text-[#5b6b82] self-center">{filtered.length} customers</span>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2a3a]">
                {["Customer ID", "Company", "Contact", "Email", "Market", "Vehicles", "Status", "Joined", "Revenue/mo"].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, idx) => (
                <tr key={c.id} className={`border-b border-[#1f2a3a]/50 hover:bg-[#161f2e]/60 transition-colors ${idx % 2 === 0 ? "" : "bg-[#0e131c]/30"}`}>
                  <td className="px-4 py-3 text-sm text-white font-mono">{c.id}</td>
                  <td className="px-4 py-3 text-sm text-white font-semibold max-w-[160px] truncate">{c.company_name}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{c.contact_person}</td>
                  <td className="px-4 py-3 text-xs text-[#5b6b82] font-mono">{c.email}</td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{MARKET_NAMES[c.market]}</td>
                  <td className="px-4 py-3 text-sm text-white font-bold text-center">{c.vehicle_count}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusBadge[c.status]}`}>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#5b6b82]">{formatDate(c.joined)}</td>
                  <td className="px-4 py-3 text-sm text-[#f5a623] font-mono">${c.monthly_revenue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
