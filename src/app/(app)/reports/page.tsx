"use client"

import { AI_REPORTS } from "@/lib/mock-data"

const freqColor: Record<string, string> = {
  DAILY: "bg-green-500/20 text-green-400 border border-green-500/30",
  WEEKLY: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  MONTHLY: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
}

const categoryIcon: Record<string, string> = {
  "Operational Intelligence": "⚙️",
  "Risk & Compliance": "🛡️",
  "Strategic & Financial": "📊",
}

const RECENT_DOWNLOADS = [
  { name: "Daily Fleet Summary", format: "PDF", user: "Tawanda Moyo", time: "2 hours ago", size: "1.4 MB" },
  { name: "SIM & Connectivity Health", format: "PDF", user: "Chipo Banda", time: "5 hours ago", size: "890 KB" },
  { name: "Fleet Efficiency Report", format: "Excel", user: "Farai Dlamini", time: "Yesterday", size: "2.1 MB" },
  { name: "Executive Summary", format: "PDF", user: "Tawanda Moyo", time: "2 days ago", size: "3.2 MB" },
  { name: "Risk Assessment Report", format: "PDF", user: "Grace Mutasa", time: "3 days ago", size: "1.7 MB" },
]

const CATEGORIES = ["All", "Operational Intelligence", "Risk & Compliance", "Strategic & Financial"]

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-6 min-h-screen bg-[#0a0e14]">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-sm text-[#94a3b8] mt-1">Scheduled and on-demand fleet intelligence reports across all markets</p>
      </div>

      {/* Category strips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {["Operational Intelligence", "Risk & Compliance", "Strategic & Financial"].map(cat => {
          const count = AI_REPORTS.filter(r => r.category === cat).length
          return (
            <div key={cat} className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl">{categoryIcon[cat]}</span>
              <div>
                <p className="text-sm font-semibold text-white">{cat}</p>
                <p className="text-xs text-[#5b6b82]">{count} reports</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Report Cards Grid */}
      <div>
        <p className="text-xl font-bold text-white mb-4">Available Reports</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {AI_REPORTS.map(report => (
            <div key={report.id} className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl p-5 hover:border-[#28374d] transition-colors flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${freqColor[report.freq]}`}>
                    {report.freq}
                  </span>
                </div>
                <span className="text-lg">{categoryIcon[report.category] ?? "📄"}</span>
              </div>
              <p className="text-base font-bold text-white mb-1">{report.title}</p>
              <p className="text-xs text-[#5b6b82] mb-1 uppercase tracking-wider">{report.category}</p>
              <p className="text-sm text-[#94a3b8] flex-1 mb-4">{report.description}</p>
              <div className="flex gap-2 mt-auto">
                <button className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 text-amber-900 font-bold px-3 py-2 rounded-xl text-xs">
                  Download PDF
                </button>
                <button className="flex-1 bg-[#0a0f17] border border-[#28374d] text-[#94a3b8] font-semibold px-3 py-2 rounded-xl text-xs hover:border-[#5b6b82] transition-colors">
                  Download Excel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Downloads */}
      <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1f2a3a]">
          <p className="text-xl font-bold text-white">Recent Downloads</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1f2a3a]">
              {["Report Name", "Format", "Downloaded By", "Time", "Size"].map(h => (
                <th key={h} className="text-left text-[10px] uppercase tracking-widest text-[#5b6b82] font-bold px-4 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {RECENT_DOWNLOADS.map((d, idx) => (
              <tr key={idx} className={`border-b border-[#1f2a3a]/50 hover:bg-[#161f2e]/60 transition-colors ${idx % 2 === 0 ? "" : "bg-[#0e131c]/30"}`}>
                <td className="px-4 py-3 text-sm text-white">{d.name}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${d.format === "PDF" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-green-500/20 text-green-400 border border-green-500/30"}`}>
                    {d.format}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#94a3b8]">{d.user}</td>
                <td className="px-4 py-3 text-sm text-[#5b6b82]">{d.time}</td>
                <td className="px-4 py-3 text-sm text-[#5b6b82] font-mono">{d.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
