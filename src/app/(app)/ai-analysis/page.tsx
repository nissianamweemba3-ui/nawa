"use client"
import { useState, useRef, useEffect } from "react"
import { AI_REPORTS, generateAIReport, KPI_STATS, ALERTS, VEHICLES, SIM_CARDS, TRACKING_DEVICES } from "@/lib/mock-data"
import { cn, fmt, fmtPct } from "@/lib/utils"
import { BrainCircuit, Download, RefreshCw, ChevronRight, Sparkles, Send, Bot, User, FileText, TrendingUp, AlertTriangle, Shield } from "lucide-react"

const SUGGESTED_QUESTIONS = [
  "Which vehicles are highest risk right now?",
  "How many SIMs are offline and what should I do?",
  "Give me an executive summary of fleet health",
  "Which markets have the worst connectivity?",
  "What are the top cost-saving opportunities?",
  "How many devices need immediate attention?",
]

type Message = { role: "user" | "assistant"; content: string; time: string }

function generateAnswer(question: string): string {
  const kpi = KPI_STATS
  const q = question.toLowerCase()

  if (q.includes("risk") || q.includes("highest")) {
    const high = VEHICLES.filter((v) => v.risk === "High")
    return `**High-Risk Vehicles (${high.length} units)**\n\n${high.slice(0, 5).map((v) => `• **${v.registration}** (${v.driver}) — ${v.market} market, currently ${v.status}, speed ${v.speed} km/h`).join("\n")}\n\nThese vehicles exhibit behaviour patterns correlated with pre-incident conditions. Recommended immediate action: driver coaching sessions and geofence review for each high-risk unit.\n\nEstimated risk reduction if coaching applied: 35% decrease in Expected Loss Cost (ELC) — approximately **$${(high.length * 980).toLocaleString()}/year** in avoided claims.`
  }

  if (q.includes("sim") || q.includes("offline") || q.includes("connectivity")) {
    const offline = SIM_CARDS.filter((s) => s.status === "offline")
    const dormant = SIM_CARDS.filter((s) => s.status === "dormant")
    return `**SIM Card Connectivity Status**\n\nCurrent fleet has **${kpi.offline_sims} offline SIMs** (${((kpi.offline_sims / kpi.total_sims) * 100).toFixed(1)}% of fleet) and **${kpi.dormant_sims} dormant SIMs** (${((kpi.dormant_sims / kpi.total_sims) * 100).toFixed(1)}%).\n\n**Recommended Actions:**\n1. **Within 24h:** Dispatch field teams to verify the top 5 longest-offline SIMs\n2. **Within 48h:** Contact customers of ${offline.length} offline vehicles to confirm tracker status\n3. **This week:** Review and deactivate SIMs dormant >90 days — estimated cost saving: **$${(dormant.length * 8.5 * 12).toFixed(0)}/year**\n\nThe SADC markets with worst connectivity are: TZ (Airtel Tanzania), ZM (Airtel Zambia), and MZ (Movitel) — consider provider SLA review.`
  }

  if (q.includes("executive") || q.includes("summary") || q.includes("health")) {
    return `**Executive Fleet Health Summary**\n\n*Generated: ${new Date().toLocaleString("en-GB")}*\n\n**Overall Status: ${kpi.fleet_utilization_pct > 50 ? "✓ Operational" : "⚠ Attention Required"}**\n\n| KPI | Value | Target | Status |\n|---|---|---|---|\n| Fleet Utilization | ${kpi.fleet_utilization_pct}% | 70% | ${kpi.fleet_utilization_pct >= 70 ? "✓" : "⚠"} |\n| SIM Connectivity | ${((kpi.active_sims / kpi.total_sims) * 100).toFixed(1)}% | 80% | ${kpi.active_sims / kpi.total_sims >= 0.8 ? "✓" : "⚠"} |\n| Device Health | ${kpi.device_health_pct}% | 90% | ${kpi.device_health_pct >= 90 ? "✓" : "⚠"} |\n| Active Customers | ${kpi.active_customers}/${kpi.customers} | 95% | ✓ |\n\n**Key Concerns:** ${ALERTS.filter((a) => !a.resolved && a.severity === "critical").length} unresolved critical alerts, ${kpi.dormant_sims} dormant SIMs, ${TRACKING_DEVICES.filter((d) => d.health === "critical").length} devices in critical health.`
  }

  if (q.includes("market") || q.includes("country") || q.includes("region")) {
    return `**Market Performance Analysis**\n\n| Market | Active SIMs | Total SIMs | Health |\n|---|---|---|---|\n| Zimbabwe (ZW) | ${SIM_CARDS.filter((s) => s.market === "ZW" && s.status === "active").length} | ${SIM_CARDS.filter((s) => s.market === "ZW").length} | ${Math.round((SIM_CARDS.filter((s) => s.market === "ZW" && s.status === "active").length / Math.max(1, SIM_CARDS.filter((s) => s.market === "ZW").length)) * 100)}% |\n| South Africa (ZA) | ${SIM_CARDS.filter((s) => s.market === "ZA" && s.status === "active").length} | ${SIM_CARDS.filter((s) => s.market === "ZA").length} | ${Math.round((SIM_CARDS.filter((s) => s.market === "ZA" && s.status === "active").length / Math.max(1, SIM_CARDS.filter((s) => s.market === "ZA").length)) * 100)}% |\n| Zambia (ZM) | ${SIM_CARDS.filter((s) => s.market === "ZM" && s.status === "active").length} | ${SIM_CARDS.filter((s) => s.market === "ZM").length} | ${Math.round((SIM_CARDS.filter((s) => s.market === "ZM" && s.status === "active").length / Math.max(1, SIM_CARDS.filter((s) => s.market === "ZM").length)) * 100)}% |\n| Tanzania (TZ) | ${SIM_CARDS.filter((s) => s.market === "TZ" && s.status === "active").length} | ${SIM_CARDS.filter((s) => s.market === "TZ").length} | ${Math.round((SIM_CARDS.filter((s) => s.market === "TZ" && s.status === "active").length / Math.max(1, SIM_CARDS.filter((s) => s.market === "TZ").length)) * 100)}% |\n\n**Insight:** Zimbabwe and South Africa show the strongest connectivity. Tanzania needs provider-level investigation.`
  }

  if (q.includes("cost") || q.includes("sav") || q.includes("opport")) {
    const idle = VEHICLES.filter((v) => v.status === "idling").length
    const dormant = SIM_CARDS.filter((s) => s.status === "dormant").length
    return `**Cost-Saving Opportunities Identified**\n\n1. **Idle Time Reduction** — ${idle} vehicles currently idling\n   • Daily fuel waste: ~$${(idle * 12.5).toFixed(0)}\n   • Monthly impact: ~$${(idle * 12.5 * 30).toFixed(0)}\n   • Action: Driver idle-time policy + automated alerts\n\n2. **Dormant SIM Deactivation** — ${dormant} SIMs silent 30+ days\n   • Monthly subscription waste: ~$${(dormant * 8.5).toFixed(0)}\n   • Annual saving: ~$${(dormant * 8.5 * 12).toFixed(0)}\n   • Action: Audit and deactivate SIMs dormant >90 days\n\n3. **Route Optimisation** — 12 vehicles on overlapping corridors\n   • Estimated monthly saving: $1,200–$3,600\n   • Action: AFIS Route Engine analysis\n\n4. **Preventive Maintenance** — ${TRACKING_DEVICES.filter((d) => d.health !== "healthy").length} devices at risk\n   • Avoidable replacement cost: ~$${(TRACKING_DEVICES.filter((d) => d.health !== "healthy").length * 280).toFixed(0)}\n\n**Total Annual Saving Potential: ~$${((idle * 12.5 * 365) + (dormant * 8.5 * 12) + 3600).toLocaleString()}**`
  }

  if (q.includes("device") || q.includes("attention") || q.includes("hardware")) {
    const critical = TRACKING_DEVICES.filter((d) => d.health === "critical")
    const warning = TRACKING_DEVICES.filter((d) => d.health === "warning")
    return `**Device Health Alert**\n\n**${critical.length} devices in CRITICAL state** — immediate action required:\n${critical.slice(0, 3).map((d) => `• **${d.id}** (${d.model}) — ${d.market}, last seen ${Math.round((Date.now() - d.last_seen.getTime()) / 86400000)}d ago`).join("\n")}\n\n**${warning.length} devices in WARNING state** — schedule inspection within 72 hours.\n\nOverall device health: **${kpi.device_health_pct}%** (target: 90%)\n\n**Recommended Actions:**\n1. Replace all ${critical.length} critical devices within 48 hours\n2. Run remote diagnostic on ${warning.length} warning devices\n3. Order replacement stock: ${Math.ceil(critical.length * 1.2)} units recommended\n4. Estimated replacement budget: **$${(critical.length * 280).toLocaleString()}**`
  }

  return `**AFIS Analysis** — *${new Date().toLocaleString("en-GB")}*\n\nBased on current fleet data:\n\n• **${kpi.total_vehicles} vehicles** across 8 SADC markets\n• Fleet utilization: **${kpi.fleet_utilization_pct}%**\n• SIM connectivity: **${((kpi.active_sims / kpi.total_sims) * 100).toFixed(1)}%**\n• Device health: **${kpi.device_health_pct}%**\n• Unresolved critical alerts: **${ALERTS.filter((a) => !a.resolved && a.severity === "critical").length}**\n\nFor specific analysis, try asking about vehicle risk, SIM connectivity, cost savings, or market performance. I can generate detailed reports for any of the 12 report categories shown in the panel.`
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n")
  return (
    <div className="prose-afis space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i}>{line.slice(3)}</h2>
        if (line.startsWith("**") && line.endsWith("**") && !line.includes(" ")) return <h3 key={i}>{line.slice(2, -2)}</h3>
        if (line.startsWith("| ")) {
          return null // handled below
        }
        if (line.startsWith("• ") || line.startsWith("1. ") || line.startsWith("2. ") || line.startsWith("3. ") || line.startsWith("4. ")) {
          const text = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          return <li key={i} dangerouslySetInnerHTML={{ __html: text }} className="text-[#94a3b8] text-sm leading-relaxed" />
        }
        if (line.trim() === "" || line.trim() === "---") return <div key={i} className="my-1" />
        const formatted = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
        return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} className="text-[#94a3b8] text-sm leading-relaxed" />
      })}
    </div>
  )
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Operational Intelligence": <TrendingUp className="w-4 h-4 text-amber-400" />,
  "Risk & Compliance": <Shield className="w-4 h-4 text-red-400" />,
  "Strategic & Financial": <Sparkles className="w-4 h-4 text-violet-400" />,
}

export default function AIAnalysisPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [reportContent, setReportContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Welcome to **AFIS AI Fleet Manager**. I have full visibility into your fleet of **${KPI_STATS.total_vehicles} vehicles** across 8 SADC markets.\n\nI can answer questions about vehicle risk, SIM connectivity, device health, cost savings, and more. I can also generate any of the 12 reports from the panel on the left.\n\nWhat would you like to know?`,
      time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    },
  ])
  const [input, setInput] = useState("")
  const [activeTab, setActiveTab] = useState<"chat" | "report">("chat")
  const chatEnd = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function selectReport(id: string) {
    setSelectedReport(id)
    setLoading(true)
    setActiveTab("report")
    setTimeout(() => {
      setReportContent(generateAIReport(id))
      setLoading(false)
    }, 1500)
  }

  function handleSend(text?: string) {
    const q = text ?? input.trim()
    if (!q) return
    const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    setMessages((m) => [...m, { role: "user", content: q, time }])
    setInput("")
    setTimeout(() => {
      const answer = generateAnswer(q)
      setMessages((m) => [...m, { role: "assistant", content: answer, time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }])
    }, 900 + Math.random() * 600)
  }

  const grouped = AI_REPORTS.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {} as Record<string, typeof AI_REPORTS>)

  return (
    <div className="animate-fadein space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-violet-400" />
            </div>
            AI Analysis Centre
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1.5">
            AFIS AI Fleet Manager · {KPI_STATS.total_vehicles} vehicles · 8 SADC markets · Powered by Claude
          </p>
        </div>
        {/* Fleet snapshot */}
        <div className="flex items-center gap-3">
          {[
            { label: "Active", value: KPI_STATS.active_vehicles, color: "text-green-400" },
            { label: "SIMs", value: `${KPI_STATS.active_sims}/${KPI_STATS.total_sims}`, color: "text-amber-400" },
            { label: "Alerts", value: ALERTS.filter((a) => !a.resolved && a.severity === "critical").length, color: "text-red-400" },
          ].map((s) => (
            <div key={s.label} className="bg-[#121925] border border-[#1f2a3a] rounded-xl px-4 py-2 text-center">
              <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-[#5b6b82] uppercase tracking-wider font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-[280px_1fr] gap-5">
        {/* Left: Report library */}
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[#1f2a3a] flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-white">Report Library</span>
            <span className="ml-auto text-xs font-mono text-[#5b6b82] bg-[#1f2a3a] px-2 py-0.5 rounded-full">12</span>
          </div>
          <div className="p-3 overflow-y-auto max-h-[600px]">
            {Object.entries(grouped).map(([cat, reports]) => (
              <div key={cat} className="mb-3">
                <div className="flex items-center gap-2 px-2 py-1.5 mb-2">
                  {CATEGORY_ICONS[cat]}
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#5b6b82]">{cat}</span>
                </div>
                {reports.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => selectReport(r.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border mb-1.5 transition-all",
                      selectedReport === r.id
                        ? "border-amber-500/40 bg-amber-500/8"
                        : "border-[#1f2a3a] hover:border-[#28374d] hover:bg-[#161f2e]"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-white leading-tight">{r.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono bg-[#1f2a3a] text-[#94a3b8] px-1.5 py-0.5 rounded-full border border-[#28374d]">
                        {r.freq}
                      </span>
                      <span className="text-[11px] text-[#5b6b82] leading-tight line-clamp-1">{r.description}</span>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Chat / Report */}
        <div className="bg-gradient-to-b from-[#121925] to-[#0e131c] border border-[#1f2a3a] rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: 600 }}>
          {/* Tabs */}
          <div className="flex border-b border-[#1f2a3a]">
            <button
              onClick={() => setActiveTab("chat")}
              className={cn("flex-1 py-3.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                activeTab === "chat" ? "text-amber-400 border-b-2 border-amber-400" : "text-[#94a3b8] hover:text-white"
              )}
            >
              <Bot className="w-4 h-4" /> Ask AFIS AI
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={cn("flex-1 py-3.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2",
                activeTab === "report" ? "text-amber-400 border-b-2 border-amber-400" : "text-[#94a3b8] hover:text-white"
              )}
            >
              <FileText className="w-4 h-4" /> Report Viewer
              {selectedReport && <span className="w-2 h-2 rounded-full bg-amber-400 ml-1" />}
            </button>
          </div>

          {/* Chat */}
          {activeTab === "chat" && (
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                      msg.role === "assistant" ? "bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30" : "bg-amber-500/20 border border-amber-500/30"
                    )}>
                      {msg.role === "assistant" ? <Bot className="w-4 h-4 text-violet-400" /> : <User className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div className={cn("max-w-[80%]", msg.role === "user" ? "items-end flex flex-col" : "")}>
                      {msg.role === "assistant" ? (
                        <div className="bg-[#161f2e] border border-[#1f2a3a] rounded-2xl rounded-tl-sm p-4">
                          <MarkdownContent content={msg.content} />
                        </div>
                      ) : (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-amber-100">
                          {msg.content}
                        </div>
                      )}
                      <div className="text-[10px] text-[#5b6b82] mt-1 px-1 font-mono">{msg.time}</div>
                    </div>
                  </div>
                ))}
                <div ref={chatEnd} />
              </div>

              {/* Suggestions */}
              <div className="px-5 pb-2">
                <div className="flex gap-2 flex-wrap">
                  {SUGGESTED_QUESTIONS.slice(0, 3).map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="text-xs text-[#94a3b8] bg-[#161f2e] border border-[#28374d] rounded-full px-3 py-1.5 hover:border-amber-500/40 hover:text-amber-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div className="p-4 border-t border-[#1f2a3a]">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Ask anything about your fleet…"
                    className="flex-1 bg-[#0a0f17] border border-[#28374d] text-white rounded-xl px-4 py-2.5 text-sm outline-none focus:border-amber-500/50 placeholder:text-[#5b6b82]"
                  />
                  <button
                    onClick={() => handleSend()}
                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-amber-900 font-bold px-4 py-2.5 rounded-xl text-sm hover:-translate-y-0.5 transition-transform"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Report viewer */}
          {activeTab === "report" && (
            <div className="flex-1 overflow-y-auto p-5">
              {!selectedReport && (
                <div className="flex flex-col items-center justify-center h-64 text-[#5b6b82]">
                  <FileText className="w-12 h-12 mb-4 opacity-30" />
                  <p className="text-sm">Select a report from the library to view it here</p>
                </div>
              )}
              {loading && (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center animate-pulse">
                    <BrainCircuit className="w-5 h-5 text-violet-400" />
                  </div>
                  <p className="text-sm text-[#94a3b8]">Generating AI report…</p>
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-amber-500" style={{ animation: `pulse-dot 1.4s ${i * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              {!loading && reportContent && (
                <div className="animate-fadein">
                  {/* Report toolbar */}
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#1f2a3a]">
                    <div>
                      <h3 className="font-bold text-white">{AI_REPORTS.find((r) => r.id === selectedReport)?.title}</h3>
                      <p className="text-xs text-[#5b6b82] mt-0.5 font-mono">{new Date().toLocaleString("en-GB")}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => selectReport(selectedReport!)} className="flex items-center gap-1.5 text-xs text-[#94a3b8] bg-[#161f2e] border border-[#28374d] rounded-lg px-3 py-1.5 hover:border-amber-500/30 transition-colors">
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                      <button className="flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-500 text-amber-900 rounded-lg px-3 py-1.5">
                        <Download className="w-3 h-3" /> Export PDF
                      </button>
                      <button className="flex items-center gap-1.5 text-xs text-[#94a3b8] bg-[#161f2e] border border-[#28374d] rounded-lg px-3 py-1.5 hover:border-green-500/30 transition-colors">
                        <Download className="w-3 h-3" /> Excel
                      </button>
                    </div>
                  </div>
                  <MarkdownContent content={reportContent} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
