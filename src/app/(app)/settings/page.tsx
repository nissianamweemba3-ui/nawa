"use client"

import { useState } from "react"

type Tab = "general" | "users" | "notifications" | "integrations" | "database"

const DEMO_USERS = [
  { name: "Tawanda Moyo", email: "tawanda@bantutrack.com", role: "Super Admin", market: "All Markets", status: "active" },
  { name: "Chipo Banda", email: "chipo@bantutrack.com", role: "Operations Manager", market: "ZW, ZM, BW", status: "active" },
  { name: "Farai Dlamini", email: "farai@bantutrack.com", role: "Analyst", market: "All Markets", status: "active" },
  { name: "Grace Mutasa", email: "grace@bantutrack.com", role: "Customer Support", market: "ZW", status: "active" },
]

const NOTIFICATIONS = [
  { label: "Critical Alerts (Offline > 24h)", key: "critical_offline", enabled: true },
  { label: "Dormant SIM Warnings", key: "dormant_sims", enabled: true },
  { label: "Speeding Events", key: "speeding", enabled: true },
  { label: "Geofence Breaches", key: "geofence", enabled: false },
  { label: "Harsh Braking Events", key: "harsh", enabled: false },
  { label: "Pre-Incident Warnings", key: "preincident", enabled: true },
  { label: "Device Health Degradation", key: "device_health", enabled: true },
  { label: "Daily Fleet Summary Email", key: "daily_summary", enabled: true },
]

const INTEGRATIONS = [
  { name: "Supabase", desc: "PostgreSQL database & real-time sync", status: "connected", color: "#34d399", icon: "🗄️" },
  { name: "OpenAI GPT-4", desc: "AI report generation engine", status: "connected", color: "#34d399", icon: "🤖" },
  { name: "Navixy GPS", desc: "Live vehicle tracking data provider", status: "pending", color: "#f59e0b", icon: "📡" },
  { name: "Twilio SMS", desc: "Alert notifications via SMS", status: "disconnected", color: "#f87171", icon: "📱" },
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general")
  const [notifications, setNotifications] = useState(
    Object.fromEntries(NOTIFICATIONS.map(n => [n.key, n.enabled]))
  )

  const TABS: { key: Tab; label: string }[] = [
    { key: "general", label: "General" },
    { key: "users", label: "Users & Roles" },
    { key: "notifications", label: "Notifications" },
    { key: "integrations", label: "Integrations" },
    { key: "database", label: "Database" },
  ]

  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Platform configuration and administration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#1f2a3a] pb-0 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-[#f5a623] text-[#f5a623]"
                : "border-transparent text-[#5b6b82] hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General */}
      {activeTab === "general" && (
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-6 space-y-4 max-w-2xl">
          <p className="text-xl font-bold text-white mb-4">Company Information</p>
          {[
            { label: "Company Name", value: "Bantu Track Pvt Ltd" },
            { label: "Platform", value: "AFIS — Advanced Fleet Intelligence System" },
            { label: "Region", value: "Sub-Saharan Africa (SADC)" },
            { label: "Markets", value: "ZW, ZM, BW, MZ, MW, NA, ZA, TZ" },
            { label: "Support Email", value: "support@bantutrack.com" },
            { label: "Platform Version", value: "v2.4.1" },
            { label: "Environment", value: "Production" },
          ].map(f => (
            <div key={f.label} className="flex items-center gap-4">
              <label className="text-xs text-[#5b6b82] uppercase tracking-widest w-44 shrink-0">{f.label}</label>
              <div className="flex-1 bg-[#0a0f17] border border-[#1f2a3a] rounded-xl px-3 py-2 text-sm text-[#94a3b8]">
                {f.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users & Roles */}
      {activeTab === "users" && (
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1f2a3a] flex items-center justify-between">
            <p className="text-xl font-bold text-white">Users & Roles</p>
            <button className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-900 font-bold px-4 py-2 rounded-xl text-sm">
              + Invite User
            </button>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2a3a]">
                {["Name", "Email", "Role", "Markets", "Status"].map(h => (
                  <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEMO_USERS.map((u, idx) => (
                <tr key={u.email} className={`border-b border-[#1f2a3a]/50 hover:bg-[#161f2e]/60 transition-colors ${idx % 2 === 0 ? "" : "bg-[#0e131c]/30"}`}>
                  <td className="px-4 py-3 text-sm text-white font-semibold">{u.name}</td>
                  <td className="px-4 py-3 text-sm text-[#5b6b82] font-mono">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#f5a623]/20 text-[#f5a623] border border-[#f5a623]/30">
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#94a3b8]">{u.market}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">ACTIVE</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notifications */}
      {activeTab === "notifications" && (
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-6 space-y-3 max-w-xl">
          <p className="text-xl font-bold text-white mb-4">Alert Notification Settings</p>
          {NOTIFICATIONS.map(n => (
            <div key={n.key} className="flex items-center justify-between py-2 border-b border-[#1f2a3a]/50">
              <span className="text-sm text-[#94a3b8]">{n.label}</span>
              <button
                onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key] }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${notifications[n.key] ? "bg-[#f5a623]" : "bg-[#1f2a3a]"}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications[n.key] ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Integrations */}
      {activeTab === "integrations" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {INTEGRATIONS.map(int => (
            <div key={int.name} className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{int.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{int.name}</p>
                    <p className="text-xs text-[#5b6b82]">{int.desc}</p>
                  </div>
                </div>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize"
                  style={{ background: `${int.color}20`, color: int.color, border: `1px solid ${int.color}40` }}
                >
                  {int.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="w-2 h-2 rounded-full" style={{ background: int.color }} />
                <span className="text-xs text-[#5b6b82]">
                  {int.status === "connected" ? "Connection healthy" : int.status === "pending" ? "Awaiting configuration" : "Not configured"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Database */}
      {activeTab === "database" && (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-6">
            <p className="text-xl font-bold text-white mb-4">Schema Overview — SIM Management Module</p>
            <div className="space-y-3">
              {[
                { table: "sim_cards", cols: "id, sim_number, iccid, network_provider, assigned_vehicle, status, market, last_communication", rows: 80 },
                { table: "vehicles", cols: "id, registration, customer_id, device_id, make, model, status, market, coords, speed, risk, driver", rows: 68 },
                { table: "tracking_devices", cols: "id, imei, model, status, health, firmware, market, last_seen", rows: 80 },
                { table: "customers", cols: "id, company_name, contact_person, email, phone, market, vehicle_count, status, monthly_revenue", rows: 30 },
                { table: "alerts", cols: "id, alert_type, severity, description, vehicle, driver, market, created_at, resolved", rows: 48 },
              ].map(t => (
                <div key={t.table} className="bg-[#0a0e14] border border-[#1f2a3a] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white font-mono">{t.table}</span>
                    <span className="text-xs text-[#5b6b82]">{t.rows} rows</span>
                  </div>
                  <p className="text-xs text-[#5b6b82] font-mono leading-relaxed">{t.cols}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
