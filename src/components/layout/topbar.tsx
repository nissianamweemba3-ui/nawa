"use client"
import { useState, useEffect } from "react"
import { Bell, Download, User, ChevronDown, LogOut, Settings } from "lucide-react"
import { ALERTS } from "@/lib/mock-data"

export function Topbar() {
  const [time, setTime] = useState("")
  const unresolved = ALERTS.filter((a) => !a.resolved && a.severity === "critical").length

  useEffect(() => {
    const tick = () => {
      setTime(new Date().toLocaleString("en-GB", {
        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit"
      }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="h-14 flex items-center px-5 gap-4 bg-gradient-to-b from-[#161f2e] to-[#121925] border-b border-[#1f2a3a] z-40">
      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-[#94a3b8] font-mono">
        <div className="w-2 h-2 rounded-full bg-green-400 pulse-green shadow-lg shadow-green-400/40" />
        <span>LIVE</span>
      </div>

      <div className="w-px h-5 bg-[#1f2a3a]" />

      {/* Clock */}
      <div className="text-xs font-mono text-[#94a3b8] bg-[#0e131c] px-3 py-1.5 rounded-lg border border-[#1f2a3a]">
        {time}
      </div>

      <div className="flex-1" />

      {/* Alerts */}
      <button className="relative p-2 rounded-lg hover:bg-[#161f2e] transition-colors">
        <Bell className="w-4 h-4 text-[#94a3b8]" />
        {unresolved > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unresolved}
          </span>
        )}
      </button>

      <div className="w-px h-5 bg-[#1f2a3a]" />

      {/* User */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center font-bold text-xs text-teal-900">
          SM
        </div>
        <div>
          <div className="text-xs font-semibold text-white leading-tight">Super Admin</div>
          <div className="text-[10px] text-[#5b6b82]">Bantu Track</div>
        </div>
      </div>
    </header>
  )
}
