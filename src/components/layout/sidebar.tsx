"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard, Map, Car, Cpu, Smartphone, Users,
  BrainCircuit, Bell, BarChart3, Settings, ChevronRight,
  Gauge, AlertTriangle,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Main Menu", items: [
    { href: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
    { href: "/ai-analysis", label: "AI Analysis Centre", icon: BrainCircuit, badge: "AI" },
    { href: "/map", label: "Live Vehicle Map", icon: Map },
  ]},
  { label: "Fleet Management", items: [
    { href: "/vehicles", label: "Vehicle Management", icon: Car },
    { href: "/devices", label: "Tracking Devices", icon: Cpu },
    { href: "/sims", label: "SIM Management", icon: Smartphone },
    { href: "/customers", label: "Customers", icon: Users },
  ]},
  { label: "Operations", items: [
    { href: "/alerts", label: "Alerts & Exceptions", icon: Bell, badge: "critical" },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/utilization", label: "Fleet Utilization", icon: Gauge },
  ]},
  { label: "System", items: [
    { href: "/settings", label: "Settings", icon: Settings },
  ]},
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col h-full bg-gradient-to-b from-[#121925] to-[#0e131c] border-r border-[#1f2a3a] w-60 flex-shrink-0">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-[#1f2a3a]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-black text-sm text-amber-900 shadow-lg shadow-amber-500/30">
            A
          </div>
          <div>
            <div className="font-black text-base tracking-tight text-white">
              AFI<span className="text-amber-400">S</span>
            </div>
            <div className="text-xs text-[#5b6b82] font-mono tracking-wider uppercase mt-0.5">Fleet Intel</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((group) => (
          <div key={group.label} className="mb-2">
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-[#5b6b82]">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 group relative",
                    active
                      ? "bg-amber-500/10 text-amber-400 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-full before:bg-amber-400"
                      : "text-[#94a3b8] hover:bg-[#161f2e] hover:text-white"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge === "AI" && (
                    <span className="text-[9px] font-mono bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full">AI</span>
                  )}
                  {item.badge === "critical" && (
                    <span className="text-[9px] font-mono bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded-full">
                      <AlertTriangle className="w-2.5 h-2.5 inline" />
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#1f2a3a] text-xs text-[#5b6b82]">
        <div className="font-mono text-[#94a3b8]">v2.5.0-prod</div>
        <div className="mt-0.5">Bantu Track Pvt Ltd</div>
      </div>
    </aside>
  )
}
